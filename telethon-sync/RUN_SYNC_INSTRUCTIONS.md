# How to Run the Member Sync Script

## Prerequisites
- Python 3.8 or higher installed
- Access to your Telegram account (phone number)
- Terminal/Command Line access

## Step 1: Install Dependencies

Navigate to the telethon-sync directory and install requirements:

```bash
cd telethon-sync
pip install -r requirements.txt
```

Or if you use pip3:
```bash
pip3 install -r requirements.txt
```

## Step 2: Create Environment File

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Open the `.env` file and update the following:

```env
# These are already configured (from .env.example):
TELEGRAM_API_ID=28077951
TELEGRAM_API_HASH=17d0f93abcccfd735df0fe79258156e0
TELEGRAM_CHAT_ID=-1002342027931
SUPABASE_URL=https://eptbjrnqydvkkplousle.supabase.co

# YOU NEED TO ADD:
TELEGRAM_PHONE_NUMBER=+1234567890  # Replace with YOUR phone number (with country code)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # Get this from Supabase dashboard

# LEAVE EMPTY for first run:
TELEGRAM_SESSION_STRING=
```

## Step 3: Get Your Supabase Service Role Key

Since this project uses Lovable Cloud, you need to get the service role key:

**Option A: From Secrets** (if you have access)
The key is already stored as a secret named `SUPABASE_SERVICE_ROLE_KEY`

**Option B: From Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the `service_role` key (NOT the anon key)
4. Paste it into your `.env` file

## Step 4: Run the Script

```bash
python sync_members.py
```

Or with Python 3:
```bash
python3 sync_members.py
```

## Step 5: Authenticate (First Run Only)

On the first run, Telegram will ask you to:
1. Enter your phone number (if not in .env)
2. Enter the verification code sent to your Telegram app
3. Enter your 2FA password (if enabled)

**IMPORTANT:** After authentication, the script will print a session string. Save this for future runs!

## Step 6: Save Session String (Optional but Recommended)

After successful authentication, the script will output:
```
🔑 SAVE THIS SESSION STRING FOR RAILWAY:
============================================================
1BVtsOIoB...very long string...
============================================================
```

Copy this string and add it to your `.env` file:
```env
TELEGRAM_SESSION_STRING=1BVtsOIoB...your session string...
```

This way, you won't need to authenticate every time you run the script.

## What the Script Does

1. ✅ Connects to Telegram using your user account
2. ✅ Fetches ALL current members from the chat (787 members)
3. ✅ Syncs them to your Supabase database
4. ✅ Removes users who are no longer in the group
5. ✅ Updates the Total Users count to match Telegram exactly

## Expected Output

```
============================================================
🤖 TELEGRAM MEMBER SYNC SCRIPT v3.0 [USER AUTH FOR FULL ACCESS]
============================================================
Started at: 2025-01-15 12:00:00

🔄 Connecting to Telegram with user account...
✅ Connected to Telegram as user account

📊 Chat Information:
  Name: MEMETROPOLIS - GLOBAL CHAT
  ID: -1002342027931
  Type: Regular Supergroup

📥 Fetching members from chat -1002342027931...
  📊 Fetched 100 members so far...
  📊 Fetched 200 members so far...
  ...
✅ Found 787 total members (excluding bots)

💾 Syncing 787 members to Supabase...
  ✅ Synced 100/787 members
  ✅ Synced 200/787 members
  ...
  ✅ Synced 787/787 members
✅ Sync complete! 787 members synced to database

============================================================
✅ ALL DONE! Synced at: 2025-01-15 12:01:30
============================================================
```

## Troubleshooting

### Error: "ModuleNotFoundError: No module named 'telethon'"
**Solution:** Install dependencies: `pip install -r requirements.txt`

### Error: "Invalid phone number"
**Solution:** Make sure your phone number includes country code (e.g., +1234567890)

### Error: "API_ID_INVALID"
**Solution:** Double-check your TELEGRAM_API_ID and TELEGRAM_API_HASH in .env

### Error: "FloodWaitError"
**Solution:** Telegram rate limit hit. Wait a few minutes and try again.

### Error: "ChatAdminRequiredError"
**Solution:** Your account must be an admin or have permission to view members

## Automation (Optional)

To run this sync automatically every day, you can:
1. Set up a cron job (Linux/Mac)
2. Use Task Scheduler (Windows)
3. Deploy to a service like Railway with the session string

Example cron job (daily at 3 AM):
```bash
0 3 * * * cd /path/to/telethon-sync && python3 sync_members.py >> sync.log 2>&1
```
