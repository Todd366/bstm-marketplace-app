// messages.js
import { supabase } from "../core/supabase-client.js";

window.BSTM.ready().then(async function(session) {
  var wall    = document.getElementById("auth-wall");
  var content = document.getElementById("messages-content") || document.getElementById("chat-content");

  if (!session) {
    if (wall)    { wall.style.display = "flex"; }
    if (content) { content.style.display = "none"; }
    return;
  }

  if (wall)    { wall.style.display = "none"; }
  if (content) { content.style.display = "block"; }

  document.querySelectorAll(".user-name, #user-name").forEach(function(el) {
    el.textContent = session.user.user_metadata?.full_name || session.user.email.split("@")[0];
  });

  // Load conversations
  try {
    var { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or("sender_id.eq." + session.user.id + ",receiver_id.eq." + session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    var listEl = document.getElementById("conversation-list") || document.getElementById("messages-list");
    if (listEl && msgs && msgs.length > 0) {
      listEl.innerHTML = msgs.map(function(m) {
        var mine = m.sender_id === session.user.id;
        return '<div style="display:flex;justify-content:' + (mine ? "flex-end" : "flex-start") + ';margin-bottom:12px;">'
          + '<div style="max-width:70%;background:' + (mine ? "linear-gradient(135deg,#7C3AED,#4F46E5)" : "#fff")
          + ';color:' + (mine ? "#fff" : "#1E1B4B") + ';padding:12px 16px;border-radius:' + (mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px")
          + ';font-size:14px;line-height:1.5;border:' + (mine ? "none" : "1px solid #EDE9FE") + ';">'
          + (m.content || "") + '</div></div>';
      }).join("");
    }
  } catch(e) {
    console.error("Messages load error:", e);
  }
});

window.logout = function() { if (confirm("Logout?")) window.BSTM.logout(); };
