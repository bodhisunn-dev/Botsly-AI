# Telegram Member Sync Guide

## Problem
The database shows 861 users but Telegram only has 787 members. This means 74 users who left the group are still in the database.

## Solution Options

### Option 1: Accurate Sync (Recommended)
Use the existing Telethon sync script to fetch the current member list from Telegram and sync it with the database.

**Steps:**
1. Navigate to the telethon-sync directory:
   ```bash
   cd telethon-sync
   ```

2. Install dependencies (if not already installed):
   ```bash
   pip install -r requirements.txt
   ```

3. Set up your environment variables in `.env`:
   ```
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   TELEGRAM_CHAT_ID=-1002342027931
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_service_role_key
   ```

4. Run the sync script:
   ```bash
   python sync_members.py
   ```

5. The script will:
   - Fetch all current members from Telegram
   - Compare with the database
   - Update the database to match exactly
   - Remove users who are no longer in the group

### Option 2: Quick Cleanup (Less Accurate)
Run the `cleanup-inactive-users.sql` script to remove obviously inactive users.

**Steps:**
1. Open your database query tool
2. Run the queries in `cleanup-inactive-users.sql`
3. This removes users who:
   - Haven't been active in 90+ days AND
   - Have 0 messages

**Note:** This won't give you exactly 787 users, but will remove ghost accounts.

### Option 3: Wait for Real-time Updates
With the new join/leave tracking I just added to the telegram webhook:
- New members will be automatically added
- Members who leave will be automatically removed
- The count will naturally sync over time as members join/leave

However, this won't fix the existing discrepancy of 74 users.

## Recommendation
Use **Option 1** (the sync script) for the most accurate results. It will query Telegram directly and ensure your database exactly matches the current member list.
