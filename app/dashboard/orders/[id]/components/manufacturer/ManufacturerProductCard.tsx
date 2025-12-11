/**
 * Manufacturer Product Card Component - DEBUG VERSION v4
 * Product card for Manufacturer users with cost pricing
 * 
 * DEBUG VERSION - EXTENSIVE CONSOLE LOGGING
 * Look for these emoji markers in console:
 * 🔵 = Margin loading
 * 🟢 = Save starting
 * 🟡 = Calculation step
 * 🟠 = Database operation
 * 🔴 = Error
 * ✅ = Success
 * 
 * Last Modified: December 5, 2025
 */

import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Package,
  Clock,
  Lock,
  Unlock,
  Send,
  CheckCircle,
  Loader2,
  Save,
  DollarSign,
  Plane,
  Ship,
  Upload,
  X,
  ChevronDown,
  Calculator,
  Edit2,
  Eye,
  EyeOff,
  Link2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { OrderProduct, OrderItem } from "../../types/order.types";
import { ProductStatusBadge } from "../../../shared-components/StatusBadge";
import { CollapsedProductHeader } from "../shared/CollapsedProductHeader";
import { getProductStatusIcon } from "../shared/ProductStatusIcon";
import { FileUploadDisplay } from "../shared/FileUploadDisplay";
import { usePermissions } from "../../hooks/usePermissions";
import { formatCurrency } from "../../../utils/orderCalculations";
import { ACCEPTED_FILE_TYPES } from "@/lib/constants/fileUpload";
import { supabase } from "@/lib/supabase";

// Define the ref type for imperative handle
export interface ManufacturerProductCardRef {
  saveAll: () => Promise<boolean>;
  getState: () => any;
}

interface ManufacturerProductCardProps {
  product: OrderProduct;
  items: OrderItem[];
  media: any[];
  orderStatus: string;
  onUpdate: () => void;
  onRoute?: (product: OrderProduct) => void;
  onViewHistory?: (productId: string) => void;
  hasNewHistory?: boolean;
  manufacturerId?: string | null;
  isSuperAdminView?: boolean;
  autoCollapse?: boolean;
  forceExpanded?: boolean;
  onExpand?: () => void;
  onDataChange?: (data: any) => void;
  allOrderProducts?: OrderProduct[]; // For shipping allocation dropdown
  translate?: (text: string | null | undefined) => string;
  t?: (key: string) => string;
}

export const ManufacturerProductCard = forwardRef<
  ManufacturerProductCardRef,
  ManufacturerProductCardProps
>(function ManufacturerProductCard(
  {
    product,
    items = [],
    media = [],
    orderStatus,
    onUpdate,
    onRoute,
    onViewHistory,
    hasNewHistory = false,
    manufacturerId,
    isSuperAdminView = false,
    autoCollapse = false,
    forceExpanded = false,
    onExpand,
    onDataChange,
    allOrderProducts = [],
    translate = (text) => text || "",
    t = (key) => key,
  },
  ref
) {
  const permissions = usePermissions() as any;
  const userRole = isSuperAdminView ? "super_admin" : "manufacturer";

  // State for finance margins - WILL BE LOADED WITH CLIENT PRIORITY
  const [productMargin, setProductMargin] = useState(80);
  const [shippingMargin, setShippingMargin] = useState(5);
  const [sampleMargin, setSampleMargin] = useState(80);
  const [marginsLoaded, setMarginsLoaded] = useState(false);
  const [marginSource, setMarginSource] = useState<{product: string, shipping: string, sample: string}>({
    product: 'default',
    shipping: 'default',
    sample: 'default'
  });

  // Collapsible state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (forceExpanded) return false;
    if (autoCollapse) return true;
    const productStatus = (product as any)?.product_status;
    return productStatus === "in_production" || productStatus === "in_transit";
  });

  // Auto-collapse when status changes
  useEffect(() => {
    if (forceExpanded) return;
    if (autoCollapse) return;
    const productStatus = (product as any)?.product_status;
    if (productStatus === "in_production" || productStatus === "in_transit") {
      setIsCollapsed(true);
    }
  }, [(product as any)?.product_status, autoCollapse, forceExpanded]);

  // State for notes
  const [tempNotes, setTempNotes] = useState("");
  const [tempBulkNotes, setTempBulkNotes] = useState("");

  // Loading states for save buttons
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingBulkSection, setSavingBulkSection] = useState(false);
  const [savingVariantNotes, setSavingVariantNotes] = useState(false);

  // State for tracking if sections have changes
  const [bulkSectionDirty, setBulkSectionDirty] = useState(false);

  const [processingProduct, setProcessingProduct] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBulkMedia, setUploadingBulkMedia] = useState(false);
  const [showNewHistoryDot, setShowNewHistoryDot] = useState(hasNewHistory);

  // State for variant notes and quantities
  const [variantNotes, setVariantNotes] = useState<{ [key: string]: string }>(
    {}
  );
  const [itemQuantities, setItemQuantities] = useState<{
    [key: string]: string;
  }>({});
  const [editingVariants, setEditingVariants] = useState(false);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [variantsDirty, setVariantsDirty] = useState(false);

  // State for bulk section - convert to strings for inputs
  const [productPrice, setProductPrice] = useState(
    (product as any).product_price?.toString() || ""
  );
  const [productionTime, setProductionTime] = useState(
    (product as any).production_time || ""
  );

  // State for production days (numeric for ETA calculation)
  const [productionDays, setProductionDays] = useState<string>(
    (product as any).production_days?.toString() || ""
  );

  // State for shipping prices - convert to strings for inputs
  const [shippingAirPrice, setShippingAirPrice] = useState(
    (product as any).shipping_air_price?.toString() || ""
  );
  const [shippingBoatPrice, setShippingBoatPrice] = useState(
    (product as any).shipping_boat_price?.toString() || ""
  );
  const [selectedShippingMethod] = useState(
    (product as any).selected_shipping_method || ""
  );

  // State for sample data
  const [sampleFee, setSampleFee] = useState(
    (product as any).sample_fee?.toString() || ""
  );
  const [sampleETA, setSampleETA] = useState((product as any).sample_eta || "");

  // State for manufacturer notes
  const [manufacturerNotes, setManufacturerNotes] = useState(
    (product as any).manufacturer_notes || ""
  );

  // State for pending file uploads
  const [pendingBulkFiles, setPendingBulkFiles] = useState<File[]>([]);

  // State for shipping allocation
  const [applyShippingToOthers, setApplyShippingToOthers] = useState(false);
  const [selectedProductsForShipping, setSelectedProductsForShipping] =
    useState<string[]>([]);

  // Initialize shipping allocation from database
  useEffect(() => {
    if ((product as any).shipping_linked_products) {
      try {
        const linkedProducts = JSON.parse(
          (product as any).shipping_linked_products
        );
        if (Array.isArray(linkedProducts) && linkedProducts.length > 0) {
          setApplyShippingToOthers(true);
          setSelectedProductsForShipping(linkedProducts);
        }
      } catch (e) {
        console.error("Error parsing shipping_linked_products:", e);
      }
    }
  }, [(product as any).shipping_linked_products]);

  // Store original values for comparison
  const [originalValues, setOriginalValues] = useState({
    productPrice: (product as any).product_price?.toString() || "",
    productionTime: (product as any).production_time || "",
    productionDays: (product as any).production_days?.toString() || "",
    bulkNotes: (product as any).client_notes || "",
    shippingAirPrice: (product as any).shipping_air_price?.toString() || "",
    shippingBoatPrice: (product as any).shipping_boat_price?.toString() || "",
    sampleFee: (product as any).sample_fee?.toString() || "",
    sampleETA: (product as any).sample_eta || "",
    manufacturerNotes: (product as any).manufacturer_notes || "",
  });

  // =========================================================================
  // 🔵 LOAD MARGINS WITH CLIENT PRIORITY - DEBUG VERSION
  // =========================================================================
  useEffect(() => {
    const loadMarginsWithClientPriority = async () => {
      console.log("🔵🔵🔵 MARGIN LOADING STARTED 🔵🔵🔵");
      console.log("🔵 Product ID:", (product as any).id);
      console.log("🔵 Order ID:", (product as any).order_id);
      
      try {
        // Step 1: Get the order to find the client_id
        const orderId = (product as any).order_id;
        if (!orderId) {
          console.log("🔴 No order_id found, using system defaults");
          await loadSystemDefaults();
          return;
        }

        console.log("🔵 Step 1: Fetching order to get client_id...");
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("client_id")
          .eq("id", orderId)
          .single();

        if (orderError) {
          console.log("🔴 Order fetch error:", orderError);
          await loadSystemDefaults();
          return;
        }

        if (!orderData?.client_id) {
          console.log("🔴 No client_id in order, using system defaults");
          await loadSystemDefaults();
          return;
        }

        console.log("🔵 Step 1 SUCCESS - client_id:", orderData.client_id);

        // Step 2: Get the client's custom margin settings
        console.log("🔵 Step 2: Fetching client margin settings...");
        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select("custom_margin_percentage, custom_shipping_margin_percentage, custom_sample_margin_percentage, name")
          .eq("id", orderData.client_id)
          .single();

        if (clientError) {
          console.log("🔴 Client fetch error:", clientError);
          await loadSystemDefaults();
          return;
        }

        console.log("🔵 Step 2 SUCCESS - Client data:", clientData);
        console.log("🔵 Client name:", clientData?.name);
        console.log("🔵 custom_margin_percentage:", clientData?.custom_margin_percentage, "(type:", typeof clientData?.custom_margin_percentage, ")");
        console.log("🔵 custom_shipping_margin_percentage:", clientData?.custom_shipping_margin_percentage, "(type:", typeof clientData?.custom_shipping_margin_percentage, ")");
        console.log("🔵 custom_sample_margin_percentage:", clientData?.custom_sample_margin_percentage, "(type:", typeof clientData?.custom_sample_margin_percentage, ")");

        // Step 3: Get system defaults
        console.log("🔵 Step 3: Fetching system defaults...");
        const { data: systemConfig, error: sysError } = await supabase
          .from("system_config")
          .select("config_key, config_value")
          .in("config_key", [
            "default_margin_percentage",
            "default_shipping_margin_percentage",
            "default_sample_margin_percentage",
          ]);

        if (sysError) {
          console.log("🔴 System config error:", sysError);
        }

        console.log("🔵 Step 3 SUCCESS - System config:", systemConfig);

        let systemProductMargin = 80;
        let systemShippingMargin = 5;
        let systemSampleMargin = 80;

        if (systemConfig) {
          systemConfig.forEach((config) => {
            console.log("🔵 Processing config:", config.config_key, "=", config.config_value);
            if (config.config_key === "default_margin_percentage") {
              systemProductMargin = parseFloat(config.config_value) || 80;
            } else if (config.config_key === "default_shipping_margin_percentage") {
              systemShippingMargin = parseFloat(config.config_value) || 5;
            } else if (config.config_key === "default_sample_margin_percentage") {
              systemSampleMargin = parseFloat(config.config_value) || 80;
            }
          });
        }

        console.log("🔵 System defaults parsed:");
        console.log("🔵   Product:", systemProductMargin + "%");
        console.log("🔵   Shipping:", systemShippingMargin + "%");
        console.log("🔵   Sample:", systemSampleMargin + "%");

        // Step 4: Apply margins with CLIENT PRIORITY
        console.log("🔵 Step 4: Applying margin priority logic...");
        
        let finalProductMargin = systemProductMargin;
        let finalShippingMargin = systemShippingMargin;
        let finalSampleMargin = systemSampleMargin;
        let productSource = 'system';
        let shippingSource = 'system';
        let sampleSource = 'system';

        // Check PRODUCT margin
        const clientProductMarginValue = clientData?.custom_margin_percentage;
        console.log("🔵 Checking product margin - value:", clientProductMarginValue, "isNull:", clientProductMarginValue === null, "isUndefined:", clientProductMarginValue === undefined);
        
        if (clientProductMarginValue !== null && clientProductMarginValue !== undefined) {
          finalProductMargin = parseFloat(clientProductMarginValue);
          productSource = `client (${clientData?.name})`;
          console.log("✅ Using CLIENT product margin:", finalProductMargin + "%");
        } else {
          console.log("🔵 Using SYSTEM product margin:", finalProductMargin + "%");
        }

        // Check SHIPPING margin
        const clientShippingMarginValue = clientData?.custom_shipping_margin_percentage;
        console.log("🔵 Checking shipping margin - value:", clientShippingMarginValue, "isNull:", clientShippingMarginValue === null, "isUndefined:", clientShippingMarginValue === undefined);
        
        if (clientShippingMarginValue !== null && clientShippingMarginValue !== undefined) {
          finalShippingMargin = parseFloat(clientShippingMarginValue);
          shippingSource = `client (${clientData?.name})`;
          console.log("✅ Using CLIENT shipping margin:", finalShippingMargin + "%");
        } else {
          console.log("🔵 Using SYSTEM shipping margin:", finalShippingMargin + "%");
        }

        // Check SAMPLE margin
        const clientSampleMarginValue = clientData?.custom_sample_margin_percentage;
        console.log("🔵 Checking sample margin - value:", clientSampleMarginValue, "isNull:", clientSampleMarginValue === null, "isUndefined:", clientSampleMarginValue === undefined);
        
        if (clientSampleMarginValue !== null && clientSampleMarginValue !== undefined) {
          finalSampleMargin = parseFloat(clientSampleMarginValue);
          sampleSource = `client (${clientData?.name})`;
          console.log("✅ Using CLIENT sample margin:", finalSampleMargin + "%");
        } else {
          console.log("🔵 Using SYSTEM sample margin:", finalSampleMargin + "%");
        }

        // Set the final margins
        console.log("🔵🔵🔵 FINAL MARGINS 🔵🔵🔵");
        console.log("🔵 Product:", finalProductMargin + "% (source:", productSource + ")");
        console.log("🔵 Shipping:", finalShippingMargin + "% (source:", shippingSource + ")");
        console.log("🔵 Sample:", finalSampleMargin + "% (source:", sampleSource + ")");
        
        setProductMargin(finalProductMargin);
        setShippingMargin(finalShippingMargin);
        setSampleMargin(finalSampleMargin);
        setMarginSource({ product: productSource, shipping: shippingSource, sample: sampleSource });
        setMarginsLoaded(true);

        console.log("🔵🔵🔵 MARGIN LOADING COMPLETE 🔵🔵🔵");

      } catch (error) {
        console.log("🔴🔴🔴 MARGIN LOADING ERROR 🔴🔴🔴", error);
        await loadSystemDefaults();
      }
    };

    // Helper to load just system defaults
    const loadSystemDefaults = async () => {
      console.log("🔵 Loading system defaults only...");
      try {
        const { data } = await supabase
          .from("system_config")
          .select("config_key, config_value")
          .in("config_key", [
            "default_margin_percentage",
            "default_shipping_margin_percentage",
            "default_sample_margin_percentage",
          ]);

        console.log("🔵 System defaults data:", data);

        if (data) {
          data.forEach((config) => {
            if (config.config_key === "default_margin_percentage") {
              setProductMargin(parseFloat(config.config_value) || 80);
            } else if (config.config_key === "default_shipping_margin_percentage") {
              setShippingMargin(parseFloat(config.config_value) || 5);
            } else if (config.config_key === "default_sample_margin_percentage") {
              setSampleMargin(parseFloat(config.config_value) || 80);
            }
          });
        }
        setMarginSource({ product: 'system', shipping: 'system', sample: 'system' });
        setMarginsLoaded(true);
        console.log("🔵 System defaults loaded successfully");
      } catch (error) {
        console.log("🔴 Error loading system defaults:", error);
        setProductMargin(80);
        setShippingMargin(5);
        setSampleMargin(80);
        setMarginsLoaded(true);
      }
    };

    loadMarginsWithClientPriority();
  }, [(product as any).order_id]);

  // Initialize item quantities and notes from items
  useEffect(() => {
    const initialQuantities: { [key: string]: string } = {};
    const initialNotes: { [key: string]: string } = {};
    items.forEach((item) => {
      initialQuantities[item.id] = item.quantity?.toString() || "0";
      initialNotes[item.id] = item.notes || "";
    });
    setItemQuantities(initialQuantities);
    setVariantNotes(initialNotes);
  }, [items]);

  // Calculate total quantity - NOW USES STATE VALUES
  const totalQuantity = Object.keys(itemQuantities).reduce((sum, itemId) => {
    return sum + (parseInt(itemQuantities[itemId]) || 0);
  }, 0);

  // Filter variants for display
  const visibleVariants =
    showAllVariants || editingVariants
      ? items
      : items.filter((item) => {
          const qty = parseInt(itemQuantities[item.id]) || 0;
          return qty > 0;
        });

  const hasHiddenVariants = items.some((item) => {
    const qty = parseInt(itemQuantities[item.id]) || 0;
    return qty === 0;
  });

  // Calculate manufacturer totals
  const calculateManufacturerTotal = () => {
    let total = 0;

    const unitPrice = parseFloat(productPrice) || 0;
    total += unitPrice * totalQuantity;

    if ((product as any).selected_shipping_method === "air") {
      const airShipping = parseFloat(shippingAirPrice) || 0;
      total += airShipping;
    } else if ((product as any).selected_shipping_method === "boat") {
      const boatShipping = parseFloat(shippingBoatPrice) || 0;
      total += boatShipping;
    }

    return total;
  };

  const manufacturerTotal = calculateManufacturerTotal();

  // Update original values when product changes
  useEffect(() => {
    setOriginalValues({
      productPrice: (product as any).product_price?.toString() || "",
      productionTime: (product as any).production_time || "",
      productionDays: (product as any).production_days?.toString() || "",
      bulkNotes: (product as any).client_notes || "",
      shippingAirPrice: (product as any).shipping_air_price?.toString() || "",
      shippingBoatPrice: (product as any).shipping_boat_price?.toString() || "",
      sampleFee: (product as any).sample_fee?.toString() || "",
      sampleETA: (product as any).sample_eta || "",
      manufacturerNotes: (product as any).manufacturer_notes || "",
    });
    setProductPrice((product as any).product_price?.toString() || "");
    setProductionTime((product as any).production_time || "");
    setProductionDays((product as any).production_days?.toString() || "");
    setShippingAirPrice((product as any).shipping_air_price?.toString() || "");
    setShippingBoatPrice(
      (product as any).shipping_boat_price?.toString() || ""
    );
    setSampleFee((product as any).sample_fee?.toString() || "");
    setSampleETA((product as any).sample_eta || "");
    setManufacturerNotes((product as any).manufacturer_notes || "");
    setPendingBulkFiles([]);
  }, [product]);

  // Get current user information
  const getCurrentUser = () => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      return {
        id: user.id || crypto.randomUUID(),
        name: user.name || user.email || "Unknown User",
      };
    }
    return {
      id: crypto.randomUUID(),
      name: "Unknown User",
    };
  };

  // =========================================================================
  // 🟢 SAVE ALL FUNCTION - DEBUG VERSION
  // =========================================================================
  useImperativeHandle(
    ref,
    () => ({
      saveAll: async () => {
        console.log("🟢🟢🟢 SAVE ALL STARTED 🟢🟢🟢");
        console.log("🟢 Product:", (product as any).product_order_number);
        console.log("🟢 Product ID:", (product as any).id);
        console.log("🟢 Margins loaded:", marginsLoaded);
        console.log("🟢 Current margins state:");
        console.log("🟢   productMargin:", productMargin);
        console.log("🟢   shippingMargin:", shippingMargin);
        console.log("🟢   sampleMargin:", sampleMargin);
        console.log("🟢   marginSource:", marginSource);

        try {
          // STEP 1: Get input values
          console.log("🟡 Step 1: Reading input values from state...");
          console.log("🟡   productPrice state:", productPrice);
          console.log("🟡   shippingAirPrice state:", shippingAirPrice);
          console.log("🟡   shippingBoatPrice state:", shippingBoatPrice);
          console.log("🟡   sampleFee state:", sampleFee);

          // Calculate CLIENT prices using the loaded margins
          const mfgProductPrice = productPrice ? parseFloat(productPrice) : null;
          const mfgAirPrice = shippingAirPrice ? parseFloat(shippingAirPrice) : null;
          const mfgBoatPrice = shippingBoatPrice ? parseFloat(shippingBoatPrice) : null;
          const mfgSampleFee = sampleFee ? parseFloat(sampleFee) : null;

          console.log("🟡 Step 2: Parsed manufacturer prices:");
          console.log("🟡   mfgProductPrice:", mfgProductPrice);
          console.log("🟡   mfgAirPrice:", mfgAirPrice);
          console.log("🟡   mfgBoatPrice:", mfgBoatPrice);
          console.log("🟡   mfgSampleFee:", mfgSampleFee);

          // Apply margins to get client prices
          console.log("🟡 Step 3: Calculating client prices with margins...");
          console.log("🟡   Product margin to apply:", productMargin + "%");
          console.log("🟡   Shipping margin to apply:", shippingMargin + "%");
          console.log("🟡   Sample margin to apply:", sampleMargin + "%");

          const clientProductPrice = mfgProductPrice
            ? mfgProductPrice * (1 + productMargin / 100)
            : null;
          const clientAirPrice = mfgAirPrice
            ? mfgAirPrice * (1 + shippingMargin / 100)
            : null;
          const clientBoatPrice = mfgBoatPrice
            ? mfgBoatPrice * (1 + shippingMargin / 100)
            : null;
          const clientSampleFee = mfgSampleFee
            ? mfgSampleFee * (1 + sampleMargin / 100)
            : null;

          console.log("🟡 Step 3 RESULTS - Calculated client prices:");
          console.log("🟡   clientProductPrice:", clientProductPrice, "(", mfgProductPrice, "* (1 +", productMargin, "/ 100) )");
          console.log("🟡   clientAirPrice:", clientAirPrice);
          console.log("🟡   clientBoatPrice:", clientBoatPrice);
          console.log("🟡   clientSampleFee:", clientSampleFee, "(", mfgSampleFee, "* (1 +", sampleMargin, "/ 100) )");

          // Combine notes
          let finalManufacturerNotes = manufacturerNotes || "";
          let finalInternalNotes = (product as any).internal_notes || "";

          if (tempBulkNotes && tempBulkNotes.trim()) {
            const timestamp = new Date().toLocaleDateString();
            finalManufacturerNotes = manufacturerNotes
              ? `${manufacturerNotes}\n\n[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`
              : `[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`;
          }

          if (tempNotes && tempNotes.trim()) {
            finalInternalNotes = tempNotes.trim();
          }

          // Prepare shipping allocation
          let shippingLinkNote = "";
          if (applyShippingToOthers && selectedProductsForShipping.length > 0) {
            const selectedNames = selectedProductsForShipping
              .map((id) => {
                const prod = allOrderProducts.find((p) => (p as any).id === id);
                return (prod as any)?.product_order_number || id;
              })
              .join(", ");
            shippingLinkNote = `Shipping fees apply to: ${selectedNames}`;
          }

          // Build update data
          const productUpdateData: any = {
            // Manufacturer prices
            product_price: mfgProductPrice,
            shipping_air_price: mfgAirPrice,
            shipping_boat_price: mfgBoatPrice,
            sample_fee: mfgSampleFee,

            // CLIENT PRICES WITH MARGINS APPLIED
            client_product_price: clientProductPrice,
            client_shipping_air_price: clientAirPrice,
            client_shipping_boat_price: clientBoatPrice,
            client_sample_fee: clientSampleFee,

            // Other fields
            production_time: productionTime || null,
            production_days: productionDays ? parseInt(productionDays) : null,
            sample_eta: sampleETA || null,
            manufacturer_notes: finalManufacturerNotes || null,
            internal_notes: finalInternalNotes || null,
            client_notes:
              tempBulkNotes && tempBulkNotes.trim()
                ? tempBulkNotes.trim()
                : (product as any).client_notes || null,

            // Shipping allocation
            shipping_linked_products:
              applyShippingToOthers && selectedProductsForShipping.length > 0
                ? JSON.stringify(selectedProductsForShipping)
                : null,
            shipping_link_note: shippingLinkNote || null,
          };

          console.log("🟠🟠🟠 DATABASE UPDATE DATA 🟠🟠🟠");
          console.log("🟠 Full update object:", JSON.stringify(productUpdateData, null, 2));

          // Execute database update
          console.log("🟠 Executing Supabase update on order_products...");
          console.log("🟠 WHERE id =", (product as any).id);

          const { data: updateResult, error: productError } = await supabase
            .from("order_products")
            .update(productUpdateData)
            .eq("id", (product as any).id)
            .select();

          if (productError) {
            console.log("🔴🔴🔴 DATABASE UPDATE ERROR 🔴🔴🔴");
            console.log("🔴 Error:", productError);
            throw productError;
          }

          console.log("✅✅✅ DATABASE UPDATE SUCCESS ✅✅✅");
          console.log("✅ Updated data returned:", updateResult);

          // Update linked products if shipping is shared
          if (applyShippingToOthers && selectedProductsForShipping.length > 0) {
            console.log("🟠 Updating linked products for shipping...");
            for (const linkedProductId of selectedProductsForShipping) {
              const linkNote = `Shipping fees included with ${(product as any).product_order_number}`;

              await supabase
                .from("order_products")
                .update({
                  shipping_link_note: linkNote,
                  shipping_air_price: 0,
                  shipping_boat_price: 0,
                  client_shipping_air_price: 0,
                  client_shipping_boat_price: 0,
                })
                .eq("id", linkedProductId);
            }
          }

          // Save variant quantities and notes
          console.log("🟠 Saving variant quantities and notes...");
          for (const item of items) {
            const newQty = parseInt(itemQuantities[item.id]) || 0;
            const newNote = variantNotes[item.id] || "";

            const { error: itemError } = await supabase
              .from("order_items")
              .update({
                quantity: newQty,
                notes: newNote,
              })
              .eq("id", item.id);

            if (itemError) {
              console.log("🔴 Error updating item", item.id, ":", itemError);
            }
          }

          // Upload pending files
          if (pendingBulkFiles.length > 0) {
            console.log("🟠 Uploading", pendingBulkFiles.length, "pending files...");
            const user = getCurrentUser();

            for (const file of pendingBulkFiles) {
              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substring(2, 8);
              const storagePath = `${(product as any).order_id}/${(product as any).id}/${timestamp}_${randomStr}_${file.name}`;

              const { error: uploadError } = await supabase.storage
                .from("order-media")
                .upload(storagePath, file);

              if (!uploadError) {
                const {
                  data: { publicUrl },
                } = supabase.storage
                  .from("order-media")
                  .getPublicUrl(storagePath);

                await supabase.from("order_media").insert({
                  order_product_id: (product as any).id,
                  file_url: publicUrl,
                  file_type: file.type.startsWith("image/")
                    ? "image"
                    : "document",
                  uploaded_by: user.id,
                  original_filename: file.name,
                  display_name: file.name,
                });
                console.log("✅ File uploaded:", file.name);
              } else {
                console.log("🔴 File upload error:", uploadError);
              }
            }
          }

          // Update order status if needed
          try {
            const { data: orderData } = await supabase
              .from("orders")
              .select("status")
              .eq("id", (product as any).order_id)
              .single();

            if (orderData && orderData.status === "sent_to_manufacturer") {
              await supabase
                .from("orders")
                .update({ status: "in_progress" })
                .eq("id", (product as any).order_id);
            }
          } catch (orderError) {
            console.log("🔴 Error updating order status:", orderError);
          }

          // Clear temp states
          setTempNotes("");
          setTempBulkNotes("");
          setPendingBulkFiles([]);
          setBulkSectionDirty(false);
          setEditingVariants(false);
          setVariantsDirty(false);
          setShowAllVariants(false);

          if (finalManufacturerNotes !== manufacturerNotes) {
            setManufacturerNotes(finalManufacturerNotes);
          }

          console.log("🟢🟢🟢 SAVE ALL COMPLETE 🟢🟢🟢");
          return true;
        } catch (error) {
          console.log("🔴🔴🔴 SAVE ALL ERROR 🔴🔴🔴", error);
          return false;
        }
      },
      getState: () => {
        return {
          productPrice,
          productionTime,
          productionDays,
          shippingAir: shippingAirPrice,
          shippingBoat: shippingBoatPrice,
          selectedShippingMethod,
          sampleFee,
          sampleETA,
          manufacturerNotes,
          tempBulkNotes,
          tempNotes,
          itemQuantities,
          variantNotes,
          pendingBulkFiles,
          margins: {
            product: productMargin,
            shipping: shippingMargin,
            sample: sampleMargin,
            source: marginSource
          }
        };
      },
    }),
    [
      productPrice,
      productionTime,
      productionDays,
      shippingAirPrice,
      shippingBoatPrice,
      selectedShippingMethod,
      sampleFee,
      sampleETA,
      manufacturerNotes,
      tempBulkNotes,
      tempNotes,
      itemQuantities,
      variantNotes,
      pendingBulkFiles,
      items,
      productMargin,
      shippingMargin,
      sampleMargin,
      marginSource,
      marginsLoaded,
      applyShippingToOthers,
      selectedProductsForShipping,
      allOrderProducts,
      (product as any).id,
      (product as any).order_id,
      (product as any).product_order_number,
      (product as any).internal_notes,
    ]
  );

  // Separate media types
  const referenceMedia = media.filter(
    (m) => m.file_type === "document" || m.file_type === "image"
  );

  // Get variant type name
  const getVariantTypeName = () => {
    if (items.length > 0 && items[0].variant_combo) {
      const combo = items[0].variant_combo.toLowerCase();

      if (
        /\b\d+(\.\d+)?\b/.test(combo) &&
        (combo.includes("us") ||
          combo.includes("eu") ||
          combo.includes("uk") ||
          /^\d+(\.\d+)?$/.test(combo.trim()))
      ) {
        return "Shoe Size";
      }

      if (
        combo.includes("small") ||
        combo.includes("medium") ||
        combo.includes("large") ||
        combo.includes("s /") ||
        combo.includes("m /") ||
        combo.includes("l /") ||
        combo.includes("xl") ||
        combo.includes("xxl") ||
        combo.includes("xxxl") ||
        combo === "s" ||
        combo === "m" ||
        combo === "l"
      ) {
        return "Size";
      }

      if (
        combo.includes("color") ||
        combo.includes("colour") ||
        combo.includes("red") ||
        combo.includes("blue") ||
        combo.includes("green") ||
        combo.includes("black") ||
        combo.includes("white")
      ) {
        return "Color";
      }

      return "Variant";
    }
    return "Variant";
  };

  const displayStatus =
    (product as any).product_status || "sent_to_manufacturer";

  const handleToggleLock = async () => {
    setProcessingProduct(true);
    try {
      const newLockStatus = !(product as any).is_locked;
      const newProductStatus = newLockStatus
        ? "in_production"
        : "pending_manufacturer";

      // Build update data
      const updateData: any = {
        is_locked: newLockStatus,
        product_status: newProductStatus,
      };

      // Set production_start_date when locking (starting production)
      if (newLockStatus) {
        updateData.production_start_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      }

      await supabase
        .from("order_products")
        .update(updateData)
        .eq("id", (product as any).id);

      if (newLockStatus && !forceExpanded) {
        setIsCollapsed(true);
      }

      onUpdate();
    } catch (error) {
      console.error("Error toggling lock:", error);
    } finally {
      setProcessingProduct(false);
    }
  };

  // =========================================================================
  // 🟢 SAVE BULK SECTION - DEBUG VERSION
  // =========================================================================
  const handleSaveBulkSection = async () => {
    console.log("🟢🟢🟢 SAVE BULK SECTION STARTED 🟢🟢🟢");
    console.log("🟢 This is the individual product save button");
    console.log("🟢 Product:", (product as any).product_order_number);
    console.log("🟢 Margins state at save time:");
    console.log("🟢   productMargin:", productMargin);
    console.log("🟢   shippingMargin:", shippingMargin);
    console.log("🟢   sampleMargin:", sampleMargin);
    console.log("🟢   marginSource:", marginSource);

    setSavingBulkSection(true);
    try {
      const user = getCurrentUser();

      // Validate no negative prices
      const price = parseFloat(productPrice) || 0;
      const airPrice = parseFloat(shippingAirPrice) || 0;
      const boatPrice = parseFloat(shippingBoatPrice) || 0;
      const samplePrice = parseFloat(sampleFee) || 0;

      console.log("🟡 Input values:");
      console.log("🟡   productPrice:", productPrice, "-> parsed:", price);
      console.log("🟡   shippingAirPrice:", shippingAirPrice, "-> parsed:", airPrice);
      console.log("🟡   shippingBoatPrice:", shippingBoatPrice, "-> parsed:", boatPrice);
      console.log("🟡   sampleFee:", sampleFee, "-> parsed:", samplePrice);

      if (price < 0 || airPrice < 0 || boatPrice < 0 || samplePrice < 0) {
        alert("Prices cannot be negative");
        return;
      }

      // Handle bulk notes
      let finalBulkNotes =
        tempBulkNotes.trim() || (product as any).client_notes || "";
      let finalManufacturerNotes = manufacturerNotes;

      if (tempBulkNotes && tempBulkNotes.trim()) {
        const timestamp = new Date().toLocaleDateString();
        finalManufacturerNotes = manufacturerNotes
          ? `${manufacturerNotes}\n\n[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`
          : `[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`;
      }

      // Prepare shipping allocation
      let shippingLinkNote = "";
      if (applyShippingToOthers && selectedProductsForShipping.length > 0) {
        const selectedNames = selectedProductsForShipping
          .map((id) => {
            const prod = allOrderProducts.find((p) => (p as any).id === id);
            return (prod as any)?.product_order_number || id;
          })
          .join(", ");
        shippingLinkNote = `Shipping fees apply to: ${selectedNames}`;
      }

      // CALCULATE CLIENT PRICES
      console.log("🟡 Calculating client prices...");
      const mfgProductPrice = productPrice ? parseFloat(productPrice) : null;
      const mfgAirPrice = shippingAirPrice ? parseFloat(shippingAirPrice) : null;
      const mfgBoatPrice = shippingBoatPrice ? parseFloat(shippingBoatPrice) : null;
      const mfgSampleFee = sampleFee ? parseFloat(sampleFee) : null;

      console.log("🟡 Manufacturer prices:");
      console.log("🟡   mfgProductPrice:", mfgProductPrice);
      console.log("🟡   mfgAirPrice:", mfgAirPrice);
      console.log("🟡   mfgBoatPrice:", mfgBoatPrice);
      console.log("🟡   mfgSampleFee:", mfgSampleFee);

      // Apply margins
      const clientProductPrice = mfgProductPrice
        ? mfgProductPrice * (1 + productMargin / 100)
        : null;
      const clientAirPrice = mfgAirPrice
        ? mfgAirPrice * (1 + shippingMargin / 100)
        : null;
      const clientBoatPrice = mfgBoatPrice
        ? mfgBoatPrice * (1 + shippingMargin / 100)
        : null;
      const clientSampleFee = mfgSampleFee
        ? mfgSampleFee * (1 + sampleMargin / 100)
        : null;

      console.log("🟡 Client prices calculated:");
      console.log("🟡   clientProductPrice:", clientProductPrice, "=", mfgProductPrice, "* (1 +", productMargin, "/ 100)");
      console.log("🟡   clientAirPrice:", clientAirPrice, "=", mfgAirPrice, "* (1 +", shippingMargin, "/ 100)");
      console.log("🟡   clientBoatPrice:", clientBoatPrice, "=", mfgBoatPrice, "* (1 +", shippingMargin, "/ 100)");
      console.log("🟡   clientSampleFee:", clientSampleFee, "=", mfgSampleFee, "* (1 +", sampleMargin, "/ 100)");

      // Build update data
      const updateData: any = {
        // Manufacturer prices
        product_price: mfgProductPrice,
        shipping_air_price: mfgAirPrice,
        shipping_boat_price: mfgBoatPrice,
        sample_fee: mfgSampleFee,

        // CLIENT PRICES WITH MARGINS
        client_product_price: clientProductPrice,
        client_shipping_air_price: clientAirPrice,
        client_shipping_boat_price: clientBoatPrice,
        client_sample_fee: clientSampleFee,

        // Other fields
        production_time: productionTime || null,
        production_days: productionDays ? parseInt(productionDays) : null,
        sample_eta: sampleETA || null,
        manufacturer_notes: finalManufacturerNotes || null,

        // Shipping allocation
        shipping_linked_products:
          applyShippingToOthers && selectedProductsForShipping.length > 0
            ? JSON.stringify(selectedProductsForShipping)
            : null,
        shipping_link_note: shippingLinkNote || null,
      };

      if (tempBulkNotes && tempBulkNotes.trim()) {
        updateData.client_notes = finalBulkNotes;
      }

      console.log("🟠🟠🟠 DATABASE UPDATE DATA 🟠🟠🟠");
      console.log("🟠 Full update object:", JSON.stringify(updateData, null, 2));
      console.log("🟠 Updating order_products WHERE id =", (product as any).id);

      // Update database
      const { data: updateResult, error } = await supabase
        .from("order_products")
        .update(updateData)
        .eq("id", (product as any).id)
        .select();

      if (error) {
        console.log("🔴🔴🔴 DATABASE ERROR 🔴🔴🔴");
        console.log("🔴 Error:", error);
        alert(`Failed to save: ${error.message || "Unknown error"}`);
        return;
      }

      console.log("✅✅✅ DATABASE UPDATE SUCCESS ✅✅✅");
      console.log("✅ Returned data:", updateResult);

      // Verify what was saved
      console.log("🟠 Verifying saved data...");
      const { data: verifyData } = await supabase
        .from("order_products")
        .select("product_price, client_product_price, sample_fee, client_sample_fee, shipping_air_price, client_shipping_air_price")
        .eq("id", (product as any).id)
        .single();
      
      console.log("✅ Verification - data in database now:", verifyData);

      // Update linked products
      if (applyShippingToOthers && selectedProductsForShipping.length > 0) {
        for (const linkedProductId of selectedProductsForShipping) {
          const linkNote = `Shipping fees included with ${(product as any).product_order_number}`;

          await supabase
            .from("order_products")
            .update({
              shipping_link_note: linkNote,
              shipping_air_price: 0,
              shipping_boat_price: 0,
              client_shipping_air_price: 0,
              client_shipping_boat_price: 0,
            })
            .eq("id", linkedProductId);
        }
      }

      // Upload files
      if (pendingBulkFiles.length > 0) {
        console.log("🟠 Uploading files...");

        for (const file of pendingBulkFiles) {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const storagePath = `${(product as any).order_id}/${(product as any).id}/${timestamp}_${randomStr}_${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from("order-media")
            .upload(storagePath, file);

          if (!uploadError) {
            const {
              data: { publicUrl },
            } = supabase.storage.from("order-media").getPublicUrl(storagePath);

            await supabase.from("order_media").insert({
              order_product_id: (product as any).id,
              file_url: publicUrl,
              file_type: file.type.startsWith("image/") ? "image" : "document",
              uploaded_by: user.id,
              original_filename: file.name,
              display_name: file.name,
            });
          }
        }
      }

      // Update original values
      setOriginalValues((prev) => ({
        ...prev,
        productPrice,
        productionTime,
        productionDays,
        shippingAirPrice,
        shippingBoatPrice,
        sampleFee,
        sampleETA,
        manufacturerNotes: finalManufacturerNotes,
        bulkNotes: finalBulkNotes,
      }));

      setManufacturerNotes(finalManufacturerNotes);

      // Clear temporary states
      setTempBulkNotes("");
      setPendingBulkFiles([]);
      setBulkSectionDirty(false);
      setShowNewHistoryDot(true);

      if (onExpand) onExpand();

      console.log("🟢🟢🟢 SAVE BULK SECTION COMPLETE 🟢🟢🟢");
      await onUpdate();
    } catch (error) {
      console.log("🔴🔴🔴 SAVE BULK SECTION ERROR 🔴🔴🔴", error);
      alert("An error occurred while saving. Please try again.");
    } finally {
      setSavingBulkSection(false);
    }
  };

  // Other handler functions
  const handleBulkFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    setPendingBulkFiles((prev) => [...prev, ...newFiles]);
    setBulkSectionDirty(true);

    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = "";
    }
  };

  const removePendingBulkFile = (index: number) => {
    setPendingBulkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await supabase.from("order_media").delete().eq("id", mediaId);

      onUpdate();
    } catch (error) {
      console.error("Error deleting media:", error);
    }
  };

  const handleFileClick = (fileUrl: string) => {
    window.open(fileUrl, "_blank");
  };

  const handleViewHistory = () => {
    if (onViewHistory) {
      onViewHistory((product as any).id);
      setShowNewHistoryDot(false);
    }
  };

  // Save variant quantities and notes
  const handleSaveVariantNotes = async () => {
    setSavingVariantNotes(true);
    try {
      let hasChanges = false;

      // Save both quantities and notes
      for (const item of items) {
        const newQty = parseInt(itemQuantities[item.id]) || 0;
        const newNote = variantNotes[item.id] || "";

        if (newQty !== item.quantity || newNote !== (item.notes || "")) {
          await supabase
            .from("order_items")
            .update({
              quantity: newQty,
              notes: newNote,
            })
            .eq("id", item.id);
          hasChanges = true;
          console.log(
            `Updated item ${item.id}: qty=${newQty}, note="${newNote}"`
          );
        }
      }

      setEditingVariants(false);
      setVariantsDirty(false);
      setShowAllVariants(false);
      await onUpdate();
    } catch (error) {
      console.error("Error saving variant notes:", error);
    } finally {
      setSavingVariantNotes(false);
    }
  };

  // Handle expand/collapse
  const handleExpand = () => {
    setIsCollapsed(false);
    if (onExpand) onExpand();
  };

  const handleCollapse = () => {
    setIsCollapsed(true);
  };

  // Use shared CollapsedProductHeader when collapsed
  if (isCollapsed) {
    return (
      <CollapsedProductHeader
        product={product}
        totalQuantity={totalQuantity}
        totalPrice={manufacturerTotal}
        isManufacturerView={true}
        onExpand={handleExpand}
        onViewHistory={handleViewHistory}
        onRoute={onRoute ? () => onRoute(product) : undefined}
        onToggleLock={handleToggleLock}
        isLocked={(product as any).is_locked}
        processingLock={processingProduct}
        hasNewHistory={showNewHistoryDot}
        userRole={userRole}
        trackingNumber={(product as any).tracking_number}
        translate={translate}
        t={t}
      />
    );
  }

  // FULL EXPANDED VIEW
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
      {/* Product Header with Collapse Button */}
      <div className="p-3 sm:p-4 bg-gray-50 border-b-2 border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Collapse Button */}
            {autoCollapse && (
              <button
                onClick={handleCollapse}
                className="p-1 hover:bg-gray-200 rounded transition-colors mt-1 flex-shrink-0"
                title="Collapse details"
              >
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
            )}

            <div className="flex-shrink-0">
              {getProductStatusIcon(displayStatus)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="font-semibold text-base sm:text-lg text-gray-900 break-words">
                  {(product as any).description ||
                    (product as any).product?.title ||
                    "Product"}
                </h3>
                <ProductStatusBadge
                  status={displayStatus}
                  translate={translate}
                  t={t}
                />
                {/* MANUFACTURER TOTAL BADGE */}
                {manufacturerTotal > 0 && (
                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 text-green-700 text-xs sm:text-sm font-semibold rounded-full flex items-center gap-1">
                    <Calculator className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Mfg Total:</span>
                    <span className="sm:hidden">Total:</span> ${formatCurrency(manufacturerTotal)}
                  </span>
                )}
              </div>
              {(product as any).description &&
                (product as any).product?.title && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                    {(product as any).product?.title}
                  </p>
                )}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-gray-500">
                <span className="break-all">{(product as any).product_order_number}</span>
                <span className="hidden sm:inline">•</span>
                <span>Qty: {totalQuantity}</span>
                {/* DEBUG: Show current margins - SUPER ADMIN ONLY */}
                {isSuperAdminView && (
                  <span className="text-blue-600 font-medium">
                    [Margins: P:{productMargin}% S:{shippingMargin}% Sample:{sampleMargin}%]
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-[auto_auto_auto] gap-1.5 sm:gap-2 w-full sm:w-fit flex-shrink-0">
            {onViewHistory && (
              <button
                onClick={handleViewHistory}
                className="px-2 sm:px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1 sm:gap-2 relative"
              >
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className=" sm:inline">History</span>
                {showNewHistoryDot && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            )}

            {onRoute && (
              <button
                onClick={() => onRoute(product)}
                className="px-2 sm:px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1 sm:gap-2"
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className=" sm:inline">Route</span>
              </button>
            )}

            <button
              onClick={handleToggleLock}
              disabled={processingProduct}
              className={`px-2 sm:px-3 py-1.5 rounded-lg transition-colors inline-flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium ${
                (product as any).is_locked
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-green-50 text-green-600 hover:bg-green-100"
              } disabled:opacity-50`}
              title={
                (product as any).is_locked
                  ? "Unlock for editing"
                  : "Lock for production"
              }
            >
              {processingProduct ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin flex-shrink-0" />
              ) : (product as any).is_locked ? (
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              ) : (
                <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              )}
              <span className=" sm:inline">
                {(product as any).is_locked ? "Unlock" : "Lock"}
              </span>
            </button>
          </div>
        </div>

        {/* Bulk Order Information */}
        <div className="mt-3 bg-white rounded-lg border border-gray-300 p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 flex-shrink-0" />
            <span className="break-words">
              {t ? t("bulkOrderInformation") : "Bulk Order Information"}
            </span>
          </h4>

          {/* Show if this product has linked shipping from another product */}
          {(product as any).shipping_link_note && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-blue-50 border border-blue-300 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm text-blue-800">
                <span className="font-medium">
                  {t ? t("shippingNote") : "Shipping Note:"}
                </span>{" "}
                {(product as any).shipping_link_note}
              </div>
            </div>
          )}

          {/* Bulk Order Notes */}
          <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h5 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
              {t ? t("bulkOrderNotes") : "Bulk Order Notes"}
            </h5>

            {manufacturerNotes && (
              <div className="mb-2 p-2 bg-blue-50 rounded text-xs sm:text-sm text-blue-700">
                <strong>{t ? t("currentNotes") : "Current notes:"}</strong>
                <div className="whitespace-pre-wrap mt-1 break-words">
                  {manufacturerNotes}
                </div>
              </div>
            )}

            <textarea
              value={tempBulkNotes}
              onChange={(e) => {
                setTempBulkNotes(e.target.value);
                setBulkSectionDirty(true);
              }}
              placeholder={
                t
                  ? t("addBulkOrderInstructions")
                  : "Add bulk order specific instructions, shipping details, production notes..."
              }
              rows={3}
              className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium text-xs sm:text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Bulk Order Media - Using Shared Component */}
          <input
            ref={bulkFileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleBulkFileUpload}
            className="hidden"
          />

          <FileUploadDisplay
            files={referenceMedia}
            pendingFiles={pendingBulkFiles}
            onFileClick={handleFileClick}
            onDeleteFile={handleDeleteMedia}
            onRemovePending={removePendingBulkFile}
            onAddFiles={() => bulkFileInputRef.current?.click()}
            title={t("bulkOrderMedia")}
            loading={uploadingBulkMedia}
            translate={translate}
            t={t}
          />

          {/* Product Price and Production Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                <span className="hidden sm:inline">
                  {t ? t("productPriceYourCost") : "Product Price (Your Cost)"}
                </span>
                <span className="sm:hidden">
                  {t ? t("price") : "Price"} ({t ? t("yourCost") : "Your Cost"})
                </span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || parseFloat(val) >= 0) {
                      setProductPrice(val);
                      setBulkSectionDirty(true);
                    }
                  }}
                  placeholder={t ? t("enterPrice") : "Enter price"}
                  className="w-full pl-7 sm:pl-8 pr-2 sm:pr-3 py-1.5 sm:py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t ? t("productionTime") : "Production Time"}
              </label>
              <div className="relative">
                <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                <input
                  type="text"
                  value={productionTime}
                  onChange={(e) => {
                    setProductionTime(e.target.value);
                    setBulkSectionDirty(true);
                  }}
                  placeholder="e.g., 2-3 weeks"
                  className="w-full pl-7 sm:pl-8 pr-2 sm:pr-3 py-1.5 sm:py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Production Days for ETA Calculation */}
            <div className="sm:col-span-2 md:col-span-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t ? t("productionDays") : "Production Days"}
              </label>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  value={productionDays}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || parseInt(val) >= 0) {
                      setProductionDays(val);
                      setBulkSectionDirty(true);
                    }
                  }}
                  placeholder="e.g., 25"
                  className="w-full pl-7 sm:pl-8 pr-10 sm:pr-12 py-1.5 sm:py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-xs sm:text-sm"
                />
                <span className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-xs sm:text-sm text-gray-400">
                  days
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t ? t("usedForETACalculation") : "Used for ETA calculation"}
              </p>
            </div>
          </div>

          {/* Shipping Options & Pricing - WITH ALLOCATION FEATURE INSIDE */}
          <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
              <h5 className="text-xs sm:text-sm font-semibold text-gray-800">
                {t
                  ? t("shippingOptionsAndPricing")
                  : "Shipping Options & Pricing"}
              </h5>

              {/* Shipping Allocation Checkbox - ALWAYS VISIBLE FOR MANUFACTURERS */}
              {allOrderProducts && allOrderProducts.length > 1 && (
                <label className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyShippingToOthers}
                    onChange={(e) => {
                      setApplyShippingToOthers(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedProductsForShipping([]);
                      }
                      setBulkSectionDirty(true);
                    }}
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                  />
                  <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 flex-shrink-0" />
                  <span className="break-words">
                    {t
                      ? t("applyFeeToMultipleProducts")
                      : "Apply fee to multiple products"}
                  </span>
                </label>
              )}
            </div>

            {/* Shipping Allocation Dropdown - Shows when checkbox is checked */}
            {applyShippingToOthers &&
              allOrderProducts &&
              allOrderProducts.length > 1 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">
                    {t
                      ? t("selectWhichProductsShareShippingFee")
                      : "Select which products share this shipping fee:"}
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
                    {allOrderProducts
                      .filter((p) => (p as any).id !== (product as any).id)
                      .map((p) => (
                        <label
                          key={(p as any).id}
                          className="flex items-start gap-2 py-1.5 px-2 hover:bg-gray-50 cursor-pointer rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProductsForShipping.includes(
                              (p as any).id
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductsForShipping((prev) => [
                                  ...prev,
                                  (p as any).id,
                                ]);
                              } else {
                                setSelectedProductsForShipping((prev) =>
                                  prev.filter((id) => id !== (p as any).id)
                                );
                              }
                              setBulkSectionDirty(true);
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                          />
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-gray-900">
                              {(p as any).product_order_number}
                            </span>
                            <span className="text-xs text-gray-600 ml-2">
                              -{" "}
                              {(p as any).description ||
                                (p as any).product?.title ||
                                (t ? t("noDescription") : "No description")}
                            </span>
                          </div>
                        </label>
                      ))}
                  </div>
                  {selectedProductsForShipping.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium mt-2">
                      <CheckCircle className="w-3 h-3" />
                      {t
                        ? `${t("shippingWillBeLinkedWith").replace("{count}", selectedProductsForShipping.length.toString())}${selectedProductsForShipping.length > 1 ? "s" : ""}`
                        : `Shipping will be linked with ${selectedProductsForShipping.length} product${selectedProductsForShipping.length > 1 ? "s" : ""}`}
                    </div>
                  )}
                </div>
              )}

            {(product as any).selected_shipping_method && (
              <div className="mb-4 p-3 bg-white rounded-lg border-2 border-blue-400 shadow-sm">
                <p className="text-xs font-medium text-blue-700 mb-2">
                  {t ? t("clientSelected") : "CLIENT SELECTED:"}
                </p>
                <div className="flex items-center gap-3">
                  {(product as any).selected_shipping_method === "air" ? (
                    <>
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Plane className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-blue-800">
                          {t ? t("airShipping").toUpperCase() : "AIR SHIPPING"}
                        </span>
                        {shippingAirPrice && (
                          <p className="text-sm text-blue-600">
                            {t ? t("price") : "Price"}: $
                            {formatCurrency(parseFloat(shippingAirPrice))}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-2 bg-cyan-100 rounded-full">
                        <Ship className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-cyan-800">
                          {t
                            ? t("boatShipping").toUpperCase()
                            : "BOAT SHIPPING"}
                        </span>
                        {shippingBoatPrice && (
                          <p className="text-sm text-cyan-600">
                            {t ? t("price") : "Price"}: $
                            {formatCurrency(parseFloat(shippingBoatPrice))}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t
                    ? t("airShippingPriceYourCost")
                    : "Air Shipping Price (Your Cost)"}
                </label>
                <div className="relative">
                  <Plane className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingAirPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseFloat(val) >= 0) {
                        setShippingAirPrice(val);
                        setBulkSectionDirty(true);
                      }
                    }}
                    placeholder={t ? t("enterAirPrice") : "Enter air price"}
                    disabled={
                      (product as any).shipping_link_note ? true : false
                    }
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t
                    ? t("boatShippingPriceYourCost")
                    : "Boat Shipping Price (Your Cost)"}
                </label>
                <div className="relative">
                  <Ship className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingBoatPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseFloat(val) >= 0) {
                        setShippingBoatPrice(val);
                        setBulkSectionDirty(true);
                      }
                    }}
                    placeholder={t ? t("enterBoatPrice") : "Enter boat price"}
                    disabled={
                      (product as any).shipping_link_note ? true : false
                    }
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MANUFACTURER PRICING SUMMARY */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-300">
            <h5 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
              <Calculator className="w-4 h-4 mr-2" />
              {t ? t("manufacturingCostSummary") : "Manufacturing Cost Summary"}
            </h5>
            <div className="space-y-2 text-sm">
              {productPrice && totalQuantity > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">
                    {t ? t("product") : "Product"}: $
                    {formatCurrency(parseFloat(productPrice))} × {totalQuantity}{" "}
                    {t ? t("units") : "units"}
                  </span>
                  <span className="font-semibold text-gray-900">
                    ${formatCurrency(parseFloat(productPrice) * totalQuantity)}
                  </span>
                </div>
              )}
              {(product as any).selected_shipping_method &&
                !(product as any).shipping_link_note && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">
                      {t ? t("shippingLabel") : "Shipping"} (
                      {(product as any).selected_shipping_method === "air"
                        ? t
                          ? t("air")
                          : "Air"
                        : t
                          ? t("boat")
                          : "Boat"}
                      )
                      {applyShippingToOthers &&
                        selectedProductsForShipping.length > 0 && (
                          <span className="text-xs text-green-600 ml-1">
                            ({t ? t("sharedWith") : "shared with"}{" "}
                            {selectedProductsForShipping.length}{" "}
                            {t ? t("products") : "products"})
                          </span>
                        )}
                    </span>
                    <span className="font-semibold text-gray-900">
                      $
                      {(product as any).selected_shipping_method === "air"
                        ? formatCurrency(parseFloat(shippingAirPrice) || 0)
                        : formatCurrency(parseFloat(shippingBoatPrice) || 0)}
                    </span>
                  </div>
                )}
              {(product as any).shipping_link_note && (
                <div className="text-xs text-blue-600 italic">
                  {(product as any).shipping_link_note}
                </div>
              )}
              {/* Sample Fee in Summary */}
              {sampleFee && parseFloat(sampleFee) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">
                    {t ? t("sampleFee") : "Sample Fee"}
                  </span>
                  <span className="font-semibold text-gray-900">
                    ${formatCurrency(parseFloat(sampleFee))}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-green-300">
                <div className="flex justify-between">
                  <span className="font-semibold text-green-800">
                    {t
                      ? t("totalManufacturingCost")
                      : "Total Manufacturing Cost"}
                  </span>
                  <span className="font-bold text-green-800 text-base">
                    ${formatCurrency(manufacturerTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save button for Bulk Section */}
          {bulkSectionDirty && (
            <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setProductPrice(originalValues.productPrice);
                  setProductionTime(originalValues.productionTime);
                  setProductionDays(originalValues.productionDays);
                  setShippingAirPrice(originalValues.shippingAirPrice);
                  setShippingBoatPrice(originalValues.shippingBoatPrice);
                  setSampleFee(originalValues.sampleFee);
                  setSampleETA(originalValues.sampleETA);
                  setManufacturerNotes(originalValues.manufacturerNotes);
                  setTempBulkNotes("");
                  setPendingBulkFiles([]);
                  setBulkSectionDirty(false);
                  setApplyShippingToOthers(false);
                  setSelectedProductsForShipping([]);
                }}
                disabled={savingBulkSection}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {t ? t("cancel") : "Cancel"}
              </button>
              <button
                onClick={handleSaveBulkSection}
                disabled={savingBulkSection}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-colors font-medium"
              >
                {savingBulkSection ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t ? t("saving") : "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    {t ? t("saveBulkSection") : "Save Bulk Section"}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Variant Details */}
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h5 className="text-sm font-semibold text-gray-800">
                {getVariantTypeName()} {t ? t("details") : "Details"}
                {!showAllVariants && hasHiddenVariants && !editingVariants && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    ({t ? t("showing") : "Showing"} {visibleVariants.length} of{" "}
                    {items.length})
                  </span>
                )}
              </h5>
              <div className="flex items-center gap-2">
                {!editingVariants && hasHiddenVariants && (
                  <button
                    onClick={() => setShowAllVariants(!showAllVariants)}
                    className="flex-1 sm:flex-initial px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {showAllVariants ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{t ? t("hideEmpty") : "Hide Empty"}</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t ? t("showAll") : "Show All"}</span>
                      </>
                    )}
                  </button>
                )}
                {!editingVariants ? (
                  <button
                    onClick={() => {
                      setEditingVariants(true);
                      setShowAllVariants(true);
                    }}
                    className="flex-1 sm:flex-initial px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{t ? t("edit") : "Edit"}</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Mobile Card Layout */}
            <div className="sm:hidden space-y-2">
              {visibleVariants.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">
                        {getVariantTypeName()}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 break-words">
                        {translate(item.variant_combo)}
                      </p>
                    </div>
                    <div className="ml-2 text-right flex-shrink-0">
                      <p className="text-xs text-gray-500 mb-0.5">Qty</p>
                      {editingVariants ? (
                        <input
                          type="number"
                          min="0"
                          value={itemQuantities[item.id] || "0"}
                          onChange={(e) => {
                            setItemQuantities((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }));
                            setVariantsDirty(true);
                          }}
                          className="w-20 px-2 py-1 text-sm text-gray-900 font-semibold text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">
                          {itemQuantities[item.id] || "0"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={variantNotes[item.id] || ""}
                      onChange={(e) => {
                        setVariantNotes((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }));
                        setVariantsDirty(true);
                        if (!editingVariants) setEditingVariants(true);
                      }}
                      placeholder={t ? t("addNote") : "Add note..."}
                      disabled={!editingVariants}
                      rows={2}
                      className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600 resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th
                      className="text-left py-2 px-3 text-sm font-medium text-gray-700"
                      style={{ width: "30%" }}
                    >
                      {getVariantTypeName()}
                    </th>
                    <th
                      className="text-left py-2 px-1 text-sm font-medium text-gray-700"
                      style={{ width: "20%" }}
                    >
                      Qty
                    </th>
                    <th
                      className="text-left py-2 pl-2 pr-3 text-sm font-medium text-gray-700"
                      style={{ width: "50%" }}
                    >
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVariants.map((item, index) => (
                    <tr
                      key={item.id}
                      className={index % 2 === 0 ? "bg-gray-50" : ""}
                    >
                      <td className="py-2 px-3 text-sm text-gray-900 font-medium">
                        {translate(item.variant_combo)}
                      </td>
                      <td className="py-2 px-1">
                        {editingVariants ? (
                          <input
                            type="number"
                            min="0"
                            value={itemQuantities[item.id] || "0"}
                            onChange={(e) => {
                              setItemQuantities((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }));
                              setVariantsDirty(true);
                            }}
                            className="w-24 px-2 py-1 text-sm text-gray-900 font-medium border border-gray-300 rounded placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">
                            {itemQuantities[item.id] || "0"}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pl-2 pr-3">
                        <input
                          type="text"
                          value={variantNotes[item.id] || ""}
                          onChange={(e) => {
                            setVariantNotes((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }));
                            setVariantsDirty(true);
                            if (!editingVariants) setEditingVariants(true);
                          }}
                          placeholder={t ? t("addNote") : "Add note..."}
                          disabled={!editingVariants}
                          className="w-full px-2 py-1 text-sm text-gray-900 font-medium border border-gray-300 rounded placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingVariants && (
              <div className="mt-3 grid grid-cols-2 sm:flex sm:justify-end gap-2">
                <button
                  onClick={() => {
                    const originalNotes: { [key: string]: string } = {};
                    const originalQtys: { [key: string]: string } = {};
                    items.forEach((item) => {
                      originalNotes[item.id] = item.notes || "";
                      originalQtys[item.id] = item.quantity?.toString() || "0";
                    });
                    setVariantNotes(originalNotes);
                    setItemQuantities(originalQtys);
                    setEditingVariants(false);
                    setVariantsDirty(false);
                    setShowAllVariants(false);
                  }}
                  disabled={savingVariantNotes}
                  className="px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>{t ? t("cancel") : "Cancel"}</span>
                </button>
                <button
                  onClick={handleSaveVariantNotes}
                  disabled={savingVariantNotes}
                  className="px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {savingVariantNotes ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t ? t("saving") : "Saving..."}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {t ? t("saveVariants") : "Save Variant Details"}
                      </span>
                      <span className="sm:hidden">
                        {t ? t("save") : "Save"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});