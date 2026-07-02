var ROOMS = [
  {id:22, name:"The Farm", room:"Room 22", desc:"Fresh organic produce, vegetables, honey and local food direct from Botswana farms.", emoji:"🌾", cat:"food", status:"open", url:"room22-farm.html", color:"#059669"},
  {id:1,  name:"CabLink Rides", room:"Room 1", desc:"Book rides across Gaborone. Earn THB for every trip.", emoji:"🚕", cat:"transport", status:"open", url:"cablink.html", color:"#D97706"},
  {id:3,  name:"THB Wallet", room:"Room 3", desc:"Your digital wallet. Store, send and receive THoBoCoin.", emoji:"💰", cat:"services", status:"open", url:"thb-wallet.html", color:"#7C3AED"},
  {id:9,  name:"TechHub", room:"Room 9", desc:"Phones, laptops, accessories and refurbished electronics.", emoji:"📱", cat:"tech", status:"coming", url:"#", color:"#0284C7"},
  {id:12, name:"Fashion House", room:"Room 12", desc:"Traditional and modern Botswana fashion and custom designs.", emoji:"👗", cat:"fashion", status:"coming", url:"#", color:"#DB2777"},
  {id:15, name:"SunTech Solar", room:"Room 15", desc:"Solar panels, chargers and off-grid energy solutions.", emoji:"☀️", cat:"tech", status:"coming", url:"#", color:"#EAB308"},
  {id:18, name:"Kgosi Arts", room:"Room 18", desc:"Original paintings, sculptures and digital art from Botswana artists.", emoji:"🎨", cat:"art", status:"coming", url:"#", color:"#8B5CF6"},
  {id:27, name:"Veld Nutrition", room:"Room 27", desc:"Superfoods, moringa, baobab and natural wellness products.", emoji:"🌿", cat:"food", status:"coming", url:"#", color:"#16A34A"},
  {id:33, name:"BSTM Pharmacy", room:"Room 33", desc:"Medicines, wellness products and health consultations.", emoji:"💊", cat:"services", status:"coming", url:"#", color:"#DC2626"},
  {id:41, name:"Maun Leather", room:"Room 41", desc:"Handcrafted premium leather goods made in Botswana.", emoji:"👜", cat:"art", status:"coming", url:"#", color:"#92400E"},
  {id:44, name:"Bots Auto Parts", room:"Room 44", desc:"Vehicle spare parts, accessories and mechanics.", emoji:"🔧", cat:"services", status:"coming", url:"#", color:"#374151"},
  {id:55, name:"Safari Gear", room:"Room 55", desc:"Outdoor, camping and safari equipment for Botswana adventures.", emoji:"🏕️", cat:"fashion", status:"coming", url:"#", color:"#065F46"},
  {id:60, name:"EduHub", room:"Room 60", desc:"Online courses, tutoring and skills training for Batswana.", emoji:"📚", cat:"services", status:"coming", url:"#", color:"#1E40AF"}
];

var currentCat = "all";
var currentSearch = "";

// ===============================
// SAFE ROOM NAVIGATION
// ===============================
function openRoom(room) {
  if (room.status === "open") {
    window.location.href = room.url;
  } else {
    alert("Room " + room.id + " — " + room.name + " is coming soon 🚀");
  }
}

// ===============================
// RENDER ROOMS
// ===============================
function renderRooms() {
  var grid = document.getElementById("rooms-grid");
  var noRes = document.getElementById("no-results");
  var count = document.getElementById("room-count");

  if (!grid) return;

  var filtered = ROOMS.filter(function (r) {
    var matchCat =
      currentCat === "all" ||
      r.cat === currentCat ||
      (currentCat === "open" && r.status === "open") ||
      (currentCat === "coming" && r.status === "coming");

    var matchSearch =
      !currentSearch ||
      r.name.toLowerCase().includes(currentSearch) ||
      r.desc.toLowerCase().includes(currentSearch) ||
      r.room.toLowerCase().includes(currentSearch);

    return matchCat && matchSearch;
  });

  if (count) count.textContent = filtered.length + " rooms";

  if (!filtered.length) {
    grid.innerHTML = "";
    if (noRes) noRes.style.display = "block";
    return;
  }

  if (noRes) noRes.style.display = "none";

  grid.innerHTML = filtered.map(function (r, i) {
    var isOpen = r.status === "open";

    return `
      <div class="room-card"
        style="
          background:#fff;
          border-radius:22px;
          overflow:hidden;
          border:1.5px solid ${isOpen ? "#DDD6FE" : "#F3F4F6"};
          cursor:pointer;
          animation-delay:${Math.min(i * 0.05, 0.4)}s
        "
        onclick='(${openRoom.toString()})(${JSON.stringify(r)})'>

        <div style="
          height:120px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:56px;
          position:relative;
          background:linear-gradient(135deg,${r.color}22,${r.color}44)
        ">
          ${r.emoji}

          <span style="
            position:absolute;
            top:10px;
            left:10px;
            background:rgba(255,255,255,0.9);
            color:${r.color};
            font-size:9px;
            font-weight:800;
            padding:3px 8px;
            border-radius:8px;
          ">
            ${r.room}
          </span>

          <span style="
            position:absolute;
            top:10px;
            right:10px;
            background:${isOpen ? "#059669" : "#6B7280"};
            color:#fff;
            font-size:9px;
            font-weight:700;
            padding:3px 10px;
            border-radius:20px;
          ">
            ${isOpen ? "● OPEN" : "SOON"}
          </span>
        </div>

        <div style="padding:16px">
          <div style="font-weight:900;color:#1E1B4B;font-size:16px;margin-bottom:4px">
            ${r.name}
          </div>

          <div style="color:#9CA3AF;font-size:12px;line-height:1.5;height:36px;overflow:hidden;margin-bottom:12px">
            ${r.desc}
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="background:#F5F3FF;color:#7C3AED;font-size:10px;font-weight:700;padding:4px 10px;border-radius:8px">
              ⚡ THB
            </span>

            <span style="color:${isOpen ? "#7C3AED" : "#9CA3AF"};font-weight:800;font-size:12px">
              ${isOpen ? "Enter →" : "Notify Me"}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ===============================
// SEARCH + FILTER
// ===============================
function doSearch() {
  var input = document.getElementById("search-input");
  currentSearch = input ? input.value.toLowerCase() : "";
  renderRooms();
}

// ===============================
// INIT EVENTS
// ===============================
document.addEventListener("DOMContentLoaded", function () {

  var searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      currentSearch = this.value.toLowerCase();
      renderRooms();
    });
  }

  document.querySelectorAll(".cat-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      currentCat = this.dataset.cat;
      renderRooms();
    });
  });

  renderRooms();
});
