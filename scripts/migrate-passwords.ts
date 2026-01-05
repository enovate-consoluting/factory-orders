// scripts/migrate-passwords.ts
// One-time script to hash existing plain text passwords
//
// Usage:
//   npx tsx scripts/migrate-passwords.ts
//
// Or add to package.json scripts:
//   "migrate-passwords": "tsx scripts/migrate-passwords.ts"

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

const SALT_ROUNDS = 12;

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function isPasswordHashed(password: string): boolean {
  // bcrypt hashes start with $2a$, $2b$, or $2y$
  return password.startsWith('$2');
}

async function migratePasswords() {
  console.log('Starting password migration...\n');

  // Fetch all users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, password');

  if (error) {
    console.error('Error fetching users:', error);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log(`Found ${users.length} users.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.password) {
      console.log(`⏭️  Skipping ${user.email}: No password set`);
      skipped++;
      continue;
    }

    if (isPasswordHashed(user.password)) {
      console.log(`⏭️  Skipping ${user.email}: Already hashed`);
      skipped++;
      continue;
    }

    // Hash the password
    try {
      const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);

      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', user.id);

      if (updateError) {
        console.error(`❌ Failed to update ${user.email}:`, updateError);
        failed++;
        continue;
      }

      console.log(`✅ Migrated ${user.email}`);
      migrated++;
    } catch (err) {
      console.error(`❌ Error hashing password for ${user.email}:`, err);
      failed++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`✅ Migrated: ${migrated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${users.length}`);

  if (failed > 0) {
    console.log('\n⚠️  Some passwords failed to migrate. Please check the errors above.');
    process.exit(1);
  }

  console.log('\n🎉 Password migration completed successfully!');
}

// Run the migration
migratePasswords().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
