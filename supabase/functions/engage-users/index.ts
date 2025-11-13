import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Starting user engagement task...');

    // Get a random less-active user (prioritize those who haven't been active recently)
    // Exclude specific users from engagement
    const { data: users } = await supabase
      .from('telegram_users')
      .select('telegram_id, first_name, username, last_active_at')
      .not('username', 'in', '("High_ju","JR28X")')
      .order('last_active_at', { ascending: true })
      .limit(20);

    if (!users || users.length === 0) {
      console.log('No users found to engage');
      return new Response(JSON.stringify({ ok: true, message: 'No users to engage' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Pick a random user from the 20 least active
    const randomUser = users[Math.floor(Math.random() * users.length)];
    
    // Get the chat ID from recent messages
    const { data: recentMessage } = await supabase
      .from('messages')
      .select('chat_id')
      .limit(1)
      .single();

    if (!recentMessage) {
      console.log('No chat found');
      return new Response(JSON.stringify({ ok: true, message: 'No chat found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const chatId = recentMessage.chat_id;

    // Create engaging messages
    const messages = [
      `Hey @${randomUser.username || randomUser.first_name}! 👋 What's good? Haven't seen you around lately!`,
      `Yo @${randomUser.username || randomUser.first_name}! 🔥 What are you up to today?`,
      `@${randomUser.username || randomUser.first_name} where you been at? 😎 Drop in and say hi!`,
      `What's poppin @${randomUser.username || randomUser.first_name}? 🚀 The chat's been missing you!`,
      `@${randomUser.username || randomUser.first_name}! 💪 Come vibe with us, what's on your mind?`,
      `Hey @${randomUser.username || randomUser.first_name}! 🎉 Got any cool updates to share?`,
      `@${randomUser.username || randomUser.first_name} yo! 👀 What's the latest with you?`,
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    // Send the engagement message
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: randomMessage,
      }),
    });

    const result = await response.json();
    console.log('Engagement message sent:', result);

    return new Response(JSON.stringify({ ok: true, user: randomUser.username || randomUser.first_name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in engage-users function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
