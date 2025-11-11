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
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const update = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update, null, 2));

    // Define allowed chat IDs
    const ALLOWED_CHAT_IDS = [
      -1002342027931, // MEMETROPOLIS - GLOBAL CHAT
      -1002153480772, // FOUNDERS CHAT
    ];

    // Handle member join events
    if (update.message?.new_chat_members) {
      const chatId = update.message.chat.id;
      
      if (ALLOWED_CHAT_IDS.includes(chatId)) {
        for (const newMember of update.message.new_chat_members) {
          if (!newMember.is_bot) {
            console.log('New member joined:', newMember.username || newMember.first_name);
            
            // Add new member to database
            await supabase
              .from('telegram_users')
              .upsert({
                telegram_id: newMember.id,
                username: newMember.username || '',
                first_name: newMember.first_name || '',
                last_name: newMember.last_name || '',
                last_active_at: new Date().toISOString(),
                is_online: false,
                online_status_updated_at: new Date().toISOString()
              }, {
                onConflict: 'telegram_id',
                ignoreDuplicates: false
              });
          }
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle member leave events
    if (update.message?.left_chat_member) {
      const chatId = update.message.chat.id;
      const leftMember = update.message.left_chat_member;
      
      if (ALLOWED_CHAT_IDS.includes(chatId) && !leftMember.is_bot) {
        console.log('Member left:', leftMember.username || leftMember.first_name);
        
        // Remove user from database
        await supabase
          .from('telegram_users')
          .delete()
          .eq('telegram_id', leftMember.id);
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract message data
    const message = update.message || update.edited_message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const chatId = message.chat.id;

    // Check if chat is allowed
    if (!ALLOWED_CHAT_IDS.includes(chatId)) {
      console.log(`⛔ Unauthorized chat ID: ${chatId} - Bot only works in Memetropolis groups`);
      return new Response(JSON.stringify({ ok: true, message: 'Unauthorized chat' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const telegramUserId = message.from.id;
    const username = message.from.username || '';
    const firstName = message.from.first_name || '';
    const lastName = message.from.last_name || '';
    const messageText = message.text || message.caption || '';

    // Upsert user and mark as online when they send a message
    const { data: userData, error: userError } = await supabase
      .from('telegram_users')
      .upsert({
        telegram_id: telegramUserId,
        username,
        first_name: firstName,
        last_name: lastName,
        last_active_at: new Date().toISOString(),
        is_online: true,
        online_status_updated_at: new Date().toISOString()
      }, {
        onConflict: 'telegram_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (userError) {
      console.error('Error upserting user:', userError);
    }

    // Update message count and calculate engagement score
    if (userData) {
      const newMessageCount = (userData.message_count || 0) + 1;
      
      // Get total messages in chat for engagement calculation
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chatId);
      
      // Calculate engagement as percentage: (user messages / total messages) * 100
      // Capped at 100%
      const engagementScore = totalMessages && totalMessages > 0 
        ? Math.min(Math.round((newMessageCount / totalMessages) * 100), 100)
        : 0;
      
      await supabase
        .from('telegram_users')
        .update({
          message_count: newMessageCount,
          engagement_score: engagementScore
        })
        .eq('id', userData.id);
    }

    // Store message
    await supabase.from('messages').insert({
      telegram_user_id: userData?.id,
      chat_id: chatId,
      message_text: messageText,
      is_bot_message: false
    });

    // React to every message with a random emoji
    if (messageText && !messageText.startsWith('/')) {
      const reactions = ['👍', '❤️', '👏', '🔥', '⭐', '💯', '🎉', '🚀', '⚡', '✨', '🎯', '💪', '🌟'];
      const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
      await setMessageReaction(chatId, message.message_id, randomReaction);
    }

    // Get bot config
    const { data: config } = await supabase.from('bot_config').select('*');
    const configMap = config?.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, any>) || {};

    // Handle pinned messages command
    if (messageText.startsWith('/pinned')) {
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      
      // Get chat info to see if it's a forum
      const chatInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`);
      const chatInfo = await chatInfoResponse.json();
      
      let pinnedMessages = [];
      
      if (chatInfo.result?.is_forum) {
        // For forum chats, we need to get pinned messages from the general topic
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getForumTopicIconStickers`);
        await sendTelegramMessage(chatId, '📌 Pinned messages in forum chats require viewing each topic individually. Please check the pinned icon in each topic!');
      } else {
        // For regular groups, get pinned message
        if (chatInfo.result?.pinned_message) {
          const msg = chatInfo.result.pinned_message;
          const text = msg.text || msg.caption || '(Media message)';
          await sendTelegramMessage(chatId, `📌 *Pinned Message:*\n\n${text}`);
        } else {
          await sendTelegramMessage(chatId, '📌 No pinned messages found in this chat.');
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle Twitter raid links command
    if (messageText.startsWith('/x')) {
      // Query recent messages from raidshark bot for raid links
      const { data: raidMessages } = await supabase
        .from('messages')
        .select('message_text, created_at')
        .eq('chat_id', chatId)
        .ilike('message_text', '%twitter.com%')
        .order('created_at', { ascending: false })
        .limit(20);

      if (raidMessages && raidMessages.length > 0) {
        let raidLinks = '🐦 *Active Twitter Raids* 🐦\n\n';
        let linkCount = 0;
        
        for (const msg of raidMessages) {
          // Extract Twitter/X links
          const twitterRegex = /(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[^\s]+/gi;
          const matches = msg.message_text.match(twitterRegex);
          
          if (matches && linkCount < 10) {
            for (const link of matches) {
              if (linkCount < 10) {
                raidLinks += `${linkCount + 1}. ${link}\n\n`;
                linkCount++;
              }
            }
          }
        }
        
        if (linkCount > 0) {
          await sendTelegramMessage(chatId, raidLinks);
        } else {
          await sendTelegramMessage(chatId, '🐦 No active Twitter raid links found. Start raiding! 🚀');
        }
      } else {
        await sendTelegramMessage(chatId, '🐦 No Twitter raid links found yet. Let\'s get raiding! 🚀');
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle top users command
    if (messageText.startsWith('/top')) {
      const { data: topUsers } = await supabase
        .from('telegram_users')
        .select('id, first_name, username, message_count, engagement_score')
        .order('engagement_score', { ascending: false })
        .order('message_count', { ascending: false })
        .limit(10);

      if (topUsers && topUsers.length > 0) {
        let leaderboardText = '🏆 *Top Chads/Chadettes* 🏆\n\n';
        
        for (const [index, user] of topUsers.entries()) {
          const name = user.first_name || user.username || 'Anonymous';
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          
          // Count image generations for this user
          const { count: imageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('telegram_user_id', user.id)
            .ilike('message_text', '/generate%');
          
          leaderboardText += `${medal} ${name}\n`;
          leaderboardText += `   💬 ${user.message_count} messages | 🔥 ${user.engagement_score} engagement`;
          if (imageCount && imageCount > 0) {
            leaderboardText += ` | 🎨 ${imageCount} images`;
          }
          leaderboardText += '\n\n';
        }
        
        await sendTelegramMessage(chatId, leaderboardText);
      } else {
        await sendTelegramMessage(chatId, 'No users yet! Start chatting to get on the leaderboard! 🚀');
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle gm/gn auto-responses
    const lowerText = messageText.toLowerCase().trim();
    if (configMap.gm_enabled && (lowerText === 'gm' || lowerText.includes('good morning'))) {
      await sendTelegramMessage(chatId, `Good morning ${firstName}! ☀️ Have a great day!`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (configMap.gn_enabled && (lowerText === 'gn' || lowerText.includes('good night'))) {
      await sendTelegramMessage(chatId, `Good night ${firstName}! 🌙 Sweet dreams!`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle image combine requests
    if (messageText.startsWith('/combine')) {
      const description = messageText.replace('/combine', '').trim();
      
      // Check if message is a reply to another message with photo
      if (message.reply_to_message?.photo && message.photo && message.photo.length > 0) {
        const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        
        // Get the first image (from the message being replied to)
        const photo1 = message.reply_to_message.photo[message.reply_to_message.photo.length - 1];
        const fileResponse1 = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photo1.file_id}`);
        const fileData1 = await fileResponse1.json();
        
        // Get the second image (from current message)
        const photo2 = message.photo[message.photo.length - 1];
        const fileResponse2 = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photo2.file_id}`);
        const fileData2 = await fileResponse2.json();
        
        if (fileData1.ok && fileData2.ok) {
          const fileUrl1 = `https://api.telegram.org/file/bot${botToken}/${fileData1.result.file_path}`;
          const fileUrl2 = `https://api.telegram.org/file/bot${botToken}/${fileData2.result.file_path}`;
          
          await sendTelegramMessage(chatId, `🎨 Combining images with: "${description}"...`);
          
          // Store the status message for tracking
          await supabase.from('messages').insert({
            telegram_user_id: userData?.id,
            chat_id: chatId,
            message_text: `Combining images: "${description}"...`,
            is_bot_message: true
          });
          
          // Call combine-images function
          const { data: combineData, error: combineError } = await supabase.functions.invoke('combine-images', {
            body: { imageUrl1: fileUrl1, imageUrl2: fileUrl2, description }
          });

          if (combineError) {
            console.error('Image combine error:', combineError);
            await sendTelegramMessage(chatId, 'Sorry, I had trouble combining those images. Please try again!');
          } else if (combineData?.image) {
            // Send combined image back to Telegram
            await sendTelegramPhoto(chatId, combineData.image);
            
            // Store success message
            await supabase.from('messages').insert({
              telegram_user_id: userData?.id,
              chat_id: chatId,
              message_text: '✅ Images combined successfully',
              is_bot_message: true
            });
          }
        }
      } else {
        await sendTelegramMessage(chatId, '📸 To combine images:\n1. Send the first image to the chat\n2. Reply to that image with a second image and caption "/combine [description]"\n\nExample: Reply to an image with another image and caption "/combine merge them into a cyberpunk scene"');
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle image remix requests
    if (messageText.startsWith('/remix')) {
      const description = messageText.replace('/remix', '').trim();
      
      // Check if message has a photo
      if (message.photo && message.photo.length > 0) {
        const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        
        // Get the largest photo
        const photo = message.photo[message.photo.length - 1];
        
        // Get file path from Telegram
        const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photo.file_id}`);
        const fileData = await fileResponse.json();
        
        if (fileData.ok) {
          const filePath = fileData.result.file_path;
          const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
          
          const statusMessage = `Generating image (remix): "${description}"...`;
          await sendTelegramMessage(chatId, `🎨 Remixing your image with: "${description}"...`);
          
          // Store the "Generating image" status message for tracking
          await supabase.from('messages').insert({
            telegram_user_id: userData?.id,
            chat_id: chatId,
            message_text: statusMessage,
            is_bot_message: true
          });
          
          // Call remix-image function
          const { data: remixData, error: remixError } = await supabase.functions.invoke('remix-image', {
            body: { imageUrl: fileUrl, description }
          });

          if (remixError) {
            console.error('Image remix error:', remixError);
            await sendTelegramMessage(chatId, 'Sorry, I had trouble remixing that image. Please try again!');
          } else if (remixData?.image) {
            // Send remixed image back to Telegram
            await sendTelegramPhoto(chatId, remixData.image);
            
            // Store success message
            await supabase.from('messages').insert({
              telegram_user_id: userData?.id,
              chat_id: chatId,
              message_text: '✅ Image remixed successfully',
              is_bot_message: true
            });
          }
        }
      } else {
        await sendTelegramMessage(chatId, '📸 Please upload an image with the /remix command!\n\nExample: Send a photo with caption "/remix make it cyberpunk style"');
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle image generation requests
    if (configMap.image_gen_enabled && messageText.includes('/generate')) {
      const prompt = messageText.replace('/generate', '').trim();
      if (prompt) {
        const statusMessage = `Generating image: "${prompt}"...`;
        await sendTelegramMessage(chatId, statusMessage);
        
        // Store the "Generating image" status message for tracking
        await supabase.from('messages').insert({
          telegram_user_id: userData?.id,
          chat_id: chatId,
          message_text: statusMessage,
          is_bot_message: true
        });
        
        // Call image generation function
        const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-image', {
          body: { prompt }
        });

        if (imageError) {
          console.error('Image generation error:', imageError);
          await sendTelegramMessage(chatId, 'Sorry, I had trouble generating that image.');
        } else if (imageData?.image) {
          // Send image back to Telegram
          await sendTelegramPhoto(chatId, imageData.image);
          
          // Store success message
          await supabase.from('messages').insert({
            telegram_user_id: userData?.id,
            chat_id: chatId,
            message_text: '✅ Image generated successfully',
            is_bot_message: true
          });
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle AI conversation
    if (configMap.conversation_mode && messageText && !messageText.startsWith('/')) {
      // Get recent conversation history
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('message_text, is_bot_message')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Call AI function
      const { data: aiData, error: aiError } = await supabase.functions.invoke('chat-ai', {
        body: {
          message: messageText,
          chatId,
          history: recentMessages || []
        }
      });

      if (aiError) {
        console.error('AI chat error:', aiError);
      } else if (aiData?.response) {
        await sendTelegramMessage(chatId, aiData.response);
        
        // Store bot response
        await supabase.from('messages').insert({
          telegram_user_id: userData?.id,
          chat_id: chatId,
          message_text: aiData.response,
          is_bot_message: true
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return;
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

async function sendTelegramPhoto(chatId: number, photoBase64: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return;
  }

  try {
    // Remove data URL prefix if present
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('photo', new Blob([bytes], { type: 'image/png' }), 'image.png');
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Telegram sendPhoto error:', response.status, errorText);
    }
  } catch (error) {
    console.error('Error sending photo:', error);
  }
}

async function setMessageReaction(chatId: number, messageId: number, emoji: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/setMessageReaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reaction: [{ type: 'emoji', emoji }],
      }),
    });
  } catch (error) {
    console.error('Error setting reaction:', error);
  }
}
