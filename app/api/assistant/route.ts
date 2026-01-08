/**
 * AI Assistant API Endpoint
 * Handles AI-powered queries for admin/super_admin users
 * Uses Claude to process natural language and query database
 * Last Modified: January 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// System prompt for the AI
const SYSTEM_PROMPT = `You are an AI assistant for BirdHaus Factory Orders, a manufacturing order management system. You help admin users with queries about orders, clients, manufacturers, and products.

## Your Capabilities:
1. Answer questions about the system and how it works
2. Help find orders, clients, products, and manufacturers
3. Provide statistics and summaries
4. Navigate users to specific pages
5. Explain order statuses and workflows

## Database Context:
- **orders**: id, order_number, status, client_id, manufacturer_id, total_amount, is_paid, created_at
  - Statuses: draft, submitted_to_manufacturer, priced_by_manufacturer, submitted_to_client, client_approved, ready_for_production, in_production, completed
- **clients**: id, name, email, phone_number
- **manufacturers**: id, name, email
- **order_products**: id, order_id, product_id, product_name, product_price, client_product_price, routed_to, product_status
- **users**: id, name, email, role

## Response Format:
- Be concise and helpful
- When providing data, format it clearly
- If you can help navigate to a specific page, include an action
- For queries requiring database access, I'll provide the results

## Actions You Can Suggest:
- Navigate to order: { "type": "navigate", "label": "View Order #X", "url": "/dashboard/orders/[id]" }
- Navigate to client: { "type": "navigate", "label": "View Client", "url": "/dashboard/clients" }
- Navigate to orders list: { "type": "navigate", "label": "View All Orders", "url": "/dashboard/orders" }

## Important:
- Never make up data - only use what's provided from database queries
- If you're not sure, say so and suggest alternatives
- Keep responses brief but informative
- Format numbers as currency when appropriate (USD)`;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI Assistant is not configured. Please add ANTHROPIC_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, userRole, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Only allow admin and super_admin
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // First, determine if we need to query the database
    const queryAnalysis = await analyzeQuery(message);

    // Execute database queries if needed
    let dbContext = '';
    if (queryAnalysis.needsData) {
      dbContext = await executeQueries(queryAnalysis);
    }

    // Build messages array for Claude
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((msg: ConversationMessage) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: dbContext
          ? `User query: "${message}"\n\nRelevant data from database:\n${dbContext}`
          : message
      }
    ];

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages
    });

    // Extract text response
    const textContent = response.content.find(block => block.type === 'text');
    const assistantMessage = textContent?.type === 'text' ? textContent.text : 'I apologize, but I couldn\'t generate a response.';

    // Parse any actions from the response
    const actions = parseActions(assistantMessage, queryAnalysis);

    return NextResponse.json({
      message: assistantMessage,
      actions
    });

  } catch (error: any) {
    console.error('Assistant API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

// Analyze the query to determine what data we need
async function analyzeQuery(message: string): Promise<{
  needsData: boolean;
  queryType: string;
  filters: any;
}> {
  const lowerMessage = message.toLowerCase();

  // Order queries
  if (lowerMessage.includes('order') || lowerMessage.includes('orders')) {
    const filters: any = {};

    // Check for specific order number
    const orderNumMatch = message.match(/order\s*#?\s*(\d+)/i) || message.match(/#(\d+)/);
    if (orderNumMatch) {
      filters.orderNumber = orderNumMatch[1];
    }

    // Check for status filters
    if (lowerMessage.includes('pending')) filters.status = 'pending';
    if (lowerMessage.includes('draft')) filters.status = 'draft';
    if (lowerMessage.includes('completed')) filters.status = 'completed';
    if (lowerMessage.includes('production')) filters.status = 'in_production';
    if (lowerMessage.includes('shipped')) filters.status = 'shipped';

    // Check for date filters
    if (lowerMessage.includes('today')) filters.dateRange = 'today';
    if (lowerMessage.includes('this week')) filters.dateRange = 'week';
    if (lowerMessage.includes('this month')) filters.dateRange = 'month';

    // Check for unpaid
    if (lowerMessage.includes('unpaid') || lowerMessage.includes('not paid')) {
      filters.isPaid = false;
    }

    return { needsData: true, queryType: 'orders', filters };
  }

  // Client queries
  if (lowerMessage.includes('client') || lowerMessage.includes('customer')) {
    const filters: any = {};

    // Try to extract client name
    const clientMatch = message.match(/client\s+["']?([^"']+)["']?/i);
    if (clientMatch) {
      filters.name = clientMatch[1].trim();
    }

    return { needsData: true, queryType: 'clients', filters };
  }

  // Statistics queries
  if (lowerMessage.includes('revenue') || lowerMessage.includes('total') ||
      lowerMessage.includes('statistics') || lowerMessage.includes('stats') ||
      lowerMessage.includes('how many')) {
    return { needsData: true, queryType: 'statistics', filters: {} };
  }

  // Product queries
  if (lowerMessage.includes('product') || lowerMessage.includes('item')) {
    return { needsData: true, queryType: 'products', filters: {} };
  }

  // Manufacturer queries
  if (lowerMessage.includes('manufacturer') || lowerMessage.includes('factory')) {
    return { needsData: true, queryType: 'manufacturers', filters: {} };
  }

  return { needsData: false, queryType: 'general', filters: {} };
}

// Execute database queries based on analysis
async function executeQueries(analysis: { queryType: string; filters: any }): Promise<string> {
  const { queryType, filters } = analysis;

  try {
    switch (queryType) {
      case 'orders': {
        let query = supabase
          .from('orders')
          .select(`
            id,
            order_number,
            status,
            total_amount,
            is_paid,
            created_at,
            clients (name, email),
            manufacturers (name)
          `)
          .order('created_at', { ascending: false })
          .limit(10);

        // Apply filters
        if (filters.orderNumber) {
          query = query.eq('order_number', parseInt(filters.orderNumber));
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.isPaid !== undefined) {
          query = query.eq('is_paid', filters.isPaid);
        }
        if (filters.dateRange === 'today') {
          const today = new Date().toISOString().split('T')[0];
          query = query.gte('created_at', today);
        } else if (filters.dateRange === 'week') {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          query = query.gte('created_at', weekAgo);
        } else if (filters.dateRange === 'month') {
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          query = query.gte('created_at', monthAgo);
        }

        const { data: orders, error } = await query;

        if (error) throw error;

        if (!orders || orders.length === 0) {
          return 'No orders found matching the criteria.';
        }

        return `Found ${orders.length} orders:\n${orders.map(o =>
          `- Order #${o.order_number}: ${o.status}, $${o.total_amount?.toFixed(2) || '0.00'}, ${o.is_paid ? 'Paid' : 'Unpaid'}, Client: ${(o.clients as any)?.name || 'N/A'}`
        ).join('\n')}`;
      }

      case 'clients': {
        let query = supabase
          .from('clients')
          .select('id, name, email, phone_number')
          .order('name')
          .limit(10);

        if (filters.name) {
          query = query.ilike('name', `%${filters.name}%`);
        }

        const { data: clients, error } = await query;

        if (error) throw error;

        if (!clients || clients.length === 0) {
          return 'No clients found.';
        }

        return `Found ${clients.length} clients:\n${clients.map(c =>
          `- ${c.name} (${c.email})`
        ).join('\n')}`;
      }

      case 'statistics': {
        // Get order stats
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('status, total_amount, is_paid, created_at');

        if (ordersError) throw ordersError;

        const stats = {
          totalOrders: orders?.length || 0,
          totalRevenue: orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
          paidOrders: orders?.filter(o => o.is_paid).length || 0,
          unpaidOrders: orders?.filter(o => !o.is_paid).length || 0,
          byStatus: {} as Record<string, number>
        };

        orders?.forEach(o => {
          stats.byStatus[o.status] = (stats.byStatus[o.status] || 0) + 1;
        });

        // Get this month's stats
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const thisMonthOrders = orders?.filter(o => o.created_at >= monthStart) || [];
        const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

        return `Statistics Overview:
- Total Orders: ${stats.totalOrders}
- Total Revenue: $${stats.totalRevenue.toFixed(2)}
- Paid: ${stats.paidOrders} | Unpaid: ${stats.unpaidOrders}
- This Month: ${thisMonthOrders.length} orders, $${thisMonthRevenue.toFixed(2)} revenue

Orders by Status:
${Object.entries(stats.byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}`;
      }

      case 'manufacturers': {
        const { data: manufacturers, error } = await supabase
          .from('manufacturers')
          .select('id, name, email')
          .order('name')
          .limit(10);

        if (error) throw error;

        if (!manufacturers || manufacturers.length === 0) {
          return 'No manufacturers found.';
        }

        return `Found ${manufacturers.length} manufacturers:\n${manufacturers.map(m =>
          `- ${m.name} (${m.email})`
        ).join('\n')}`;
      }

      case 'products': {
        const { data: products, error } = await supabase
          .from('products')
          .select('id, name, sku')
          .order('name')
          .limit(10);

        if (error) throw error;

        if (!products || products.length === 0) {
          return 'No products found.';
        }

        return `Found ${products.length} products:\n${products.map(p =>
          `- ${p.name} (SKU: ${p.sku || 'N/A'})`
        ).join('\n')}`;
      }

      default:
        return '';
    }
  } catch (error: any) {
    console.error('Database query error:', error);
    return `Error fetching data: ${error.message}`;
  }
}

// Parse actions from assistant response
function parseActions(message: string, analysis: { queryType: string; filters: any }): any[] {
  const actions: any[] = [];

  // Check for specific order reference
  const orderMatch = message.match(/order\s*#?\s*(\d+)/i);
  if (orderMatch && analysis.queryType === 'orders' && analysis.filters.orderNumber) {
    // We'd need to get the order ID here - for now, suggest going to orders page
    actions.push({
      type: 'navigate',
      label: `View Order #${orderMatch[1]}`,
      url: '/dashboard/orders'
    });
  }

  // Add contextual navigation based on query type
  if (analysis.queryType === 'orders' && !actions.length) {
    actions.push({
      type: 'navigate',
      label: 'View All Orders',
      url: '/dashboard/orders'
    });
  }

  if (analysis.queryType === 'clients') {
    actions.push({
      type: 'navigate',
      label: 'View Clients',
      url: '/dashboard/clients'
    });
  }

  if (analysis.queryType === 'manufacturers') {
    actions.push({
      type: 'navigate',
      label: 'View Manufacturers',
      url: '/dashboard/manufacturers'
    });
  }

  return actions;
}
