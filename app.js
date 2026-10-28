(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const supabase = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = id => document.getElementById(id);
  const localNameKey = "tutorial_video_visitor_name";
  let settings = {site_name:"Tutorial Video",site_title:"শিখুন নিজের গতিতে",site_description:"আপনার প্রতিষ্ঠানের টিউটোরিয়াল ভিডিও এক জায়গায়। ভিডিও দেখতে অ্যাকাউন্ট লাগবে না।"};
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const notify = (msg) => { const node = document.createElement("div"); node.className="toast"; node.textContent=msg; document.body.appendChild(node); setTimeout(()=>node.remove(),2600); };

  function showName() {
    const saved = localStorage.getItem(localNameKey);
    if (saved) $("visitor-greeting").textContent = `স্বাগতম, ${saved}`;
    else $("name-dialog").showModal();
  }
  $("name-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("visitor-name").value.trim();
    if (!name) return;
    localStorage.setItem(localNameKey, name);
    $("name-dialog").close();
    $("visitor-greeting").textContent = `স্বাগতম, ${name}`;
  });

  function applySettings(s) {
    settings = {...settings, ...(s || {})};
    $("site-name").textContent = settings.site_name;
    $("footer-name").textContent = settings.site_name;
    $("site-title").textContent = settings.site_title;
    $("site-description").textContent = settings.site_description;
    document.title = `${settings.site_name} — Tutorial Videos`;
  }

  function renderVideos(videos) {
    $("video-total").textContent = `${videos.length}টি ভিডিও`;
    if (!videos.length) {
      $("video-feed").innerHTML = '<div class="empty-state">এখনো কোনো ভিডিও প্রকাশ করা হয়নি।</div>';
      return;
    }
    $("video-feed").innerHTML = videos.map(v => `
      <article class="video-card" id="video-${escapeHtml(v.id)}">
        <video controls playsinline preload="metadata" ${v.thumbnail_url ? `poster="${escapeHtml(v.thumbnail_url)}"` : ""} src="${escapeHtml(v.video_url)}"></video>
        <div class="video-card-content">
          <h2>${escapeHtml(v.title)}</h2>
          <p class="muted description">${escapeHtml(v.description || "")}</p>
          <div class="video-meta"><span>▶ <strong id="view-count-${escapeHtml(v.id)}">${Number(v.views || 0).toLocaleString()}</strong> views</span><span class="pill">Tutorial</span></div>
          <div class="video-actions">
            <button class="button button-quiet" data-share="${escapeHtml(v.id)}">↗ শেয়ার</button>
            <button class="button button-quiet" data-fullscreen="${escapeHtml(v.id)}">⛶ Fullscreen</button>
            <button class="button button-quiet" data-pip="${escapeHtml(v.id)}">▣ Floating</button>
          </div>
        </div>
      </article>`).join("");
    $("video-feed").querySelectorAll("[data-share]").forEach(b => b.addEventListener("click", () => shareVideo(b.dataset.share)));
    $("video-feed").querySelectorAll("[data-fullscreen]").forEach(b => b.addEventListener("click", () => fullscreen(b.dataset.fullscreen)));
    $("video-feed").querySelectorAll("[data-pip]").forEach(b => b.addEventListener("click", () => pip(b.dataset.pip)));
    $("video-feed").querySelectorAll("video").forEach(video => video.addEventListener("play", () => countView(video.closest(".video-card").id.replace("video-",""))));
    if (location.hash.startsWith("#video-")) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 400);
  }

  async function shareVideo(id) {
    const url = new URL(location.href); url.hash = `video-${id}`;
    const title = document.querySelector(`#video-${CSS.escape(id)} h2`)?.textContent || settings.site_name;
    try {
      if (navigator.share) await navigator.share({title, url:url.href});
      else { await navigator.clipboard.writeText(url.href); notify("ভিডিও লিংক কপি হয়েছে"); }
    } catch (_) {}
  }
  function fullscreen(id) {
    const video = document.querySelector(`#video-${CSS.escape(id)} video`);
    if (video?.requestFullscreen) video.requestFullscreen();
    else if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else notify("এই ব্রাউজারে fullscreen সমর্থিত নয়।");
  }
  async function pip(id) {
    const video = document.querySelector(`#video-${CSS.escape(id)} video`);
    try {
      if (document.pictureInPictureEnabled && video?.requestPictureInPicture) await video.requestPictureInPicture();
      else notify("এই ব্রাউজারে Floating Player সমর্থিত নয়।");
    } catch (_) { notify("Floating Player চালু করা যায়নি।"); }
  }
  async function countView(id) {
    // A session-level guard reduces repeated counts; authoritative counting is enforced server-side.
    const key = `tutorial_video_viewed_${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    if (!supabase) return;
    const {error} = await supabase.rpc("increment_video_view", {video_id_input:id});
    if (!error) {
      const el = $(`view-count-${id}`);
      if (el) el.textContent = (Number(el.textContent.replace(/,/g,"")) + 1).toLocaleString();
    }
  }
  async function init() {
    showName();
    if (!supabase) {
      $("video-feed").innerHTML = '<div class="empty-state"><strong>সেটআপ বাকি আছে</strong><br>config.js-এ Supabase URL ও anon key বসিয়ে SQL সেটআপ শেষ করলে পাবলিক ভিডিও এখানে দেখা যাবে।</div>';
      $("video-total").textContent = "0টি ভিডিও";
      return;
    }
    const [settingResult, videoResult] = await Promise.all([
      supabase.from("site_settings").select("site_name,site_title,site_description").eq("id",1).maybeSingle(),
      supabase.from("videos").select("id,title,description,video_url,thumbnail_url,views,created_at").eq("published",true).order("created_at",{ascending:false})
    ]);
    if (settingResult.data) applySettings(settingResult.data);
    if (videoResult.error) {
      $("video-feed").innerHTML = '<div class="empty-state">ভিডিও লোড করা যায়নি। Supabase সেটআপ ও RLS policy যাচাই করুন।</div>';
      return;
    }
    renderVideos(videoResult.data || []);
  }
  applySettings(settings);
  init();
})();
