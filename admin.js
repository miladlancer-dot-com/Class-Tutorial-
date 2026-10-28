(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const sb = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const msg = (text, bad=false) => { $("dashboard-message").textContent=text; $("dashboard-message").className="status-message "+(bad?"error":"success"); };
  let editingVideo = null;
  const maxBytes = (Number(cfg.MAX_VIDEO_SIZE_MB)||200)*1024*1024;
  function showDashboard(isLoggedIn) {
    $("login-section").classList.toggle("hidden", isLoggedIn);
    $("dashboard").classList.toggle("hidden", !isLoggedIn);
    if (isLoggedIn) loadDashboard();
  }
  async function requireAdmin() {
    if (!sb) { $("login-message").textContent="আগে config.js-এ Supabase URL ও anon key সেট করুন।"; return; }
    const {data:{session}} = await sb.auth.getSession();
    showDashboard(!!session);
  }
  $("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!sb) { $("login-message").textContent="Supabase সেটআপ করা হয়নি।"; return; }
    $("login-message").textContent="লগইন হচ্ছে…";
    const {error} = await sb.auth.signInWithPassword({email:$("admin-email").value.trim(),password:$("admin-password").value});
    if (error) $("login-message").textContent="লগইন ব্যর্থ। ইমেইল/পাসওয়ার্ড এবং admin role যাচাই করুন।";
    else { $("login-message").textContent=""; showDashboard(true); }
  });
  $("logout-button").addEventListener("click", async()=>{await sb.auth.signOut();showDashboard(false);});
  $("settings-form").addEventListener("submit", async e=>{
    e.preventDefault();
    const payload={id:1,site_name:$("setting-name").value.trim(),site_title:$("setting-title").value.trim(),site_description:$("setting-description").value.trim(),updated_at:new Date().toISOString()};
    const {error}=await sb.from("site_settings").upsert(payload);
    msg(error ? "সেটিংস সংরক্ষণ হয়নি: "+error.message : "সেটিংস সবার জন্য সংরক্ষণ হয়েছে।",!!error);
  });
  $("video-form").addEventListener("submit", async e=>{
    e.preventDefault();
    const id=$("edit-video-id").value;
    const title=$("video-title").value.trim();
    const description=$("video-description").value.trim();
    const thumbnail_url=$("video-thumbnail").value.trim()||null;
    const file=$("video-file").files[0];
    if (!title) return msg("ভিডিওর শিরোনাম দিন।",true);
    if (!id && !file) return msg("ভিডিও আপলোড করতে একটি ফাইল নির্বাচন করুন।",true);
    if (file && file.size>maxBytes) return msg(`ফাইলটি ${cfg.MAX_VIDEO_SIZE_MB||200} MB সীমার চেয়ে বড়।`,true);
    let video_url=null, storage_path=null;
    try {
      if (file) {
        const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-");
        storage_path=`${crypto.randomUUID()}-${safeName}`;
        const {error:uploadError}=await sb.storage.from(cfg.VIDEO_BUCKET||"tutorial-videos").upload(storage_path,file,{contentType:file.type||"video/mp4",upsert:false});
        if (uploadError) throw uploadError;
        const {data}=sb.storage.from(cfg.VIDEO_BUCKET||"tutorial-videos").getPublicUrl(storage_path);
        video_url=data.publicUrl;
      }
      if (id) {
        const old = window.currentAdminVideos.find(v=>v.id===id);
        const patch={title,description,thumbnail_url,updated_at:new Date().toISOString()};
        if (file) { patch.video_url=video_url; patch.storage_path=storage_path; }
        const {error}=await sb.from("videos").update(patch).eq("id",id);
        if(error) throw error;
        if(file && old?.storage_path) await sb.storage.from(cfg.VIDEO_BUCKET||"tutorial-videos").remove([old.storage_path]);
      } else {
        const {error}=await sb.from("videos").insert({title,description,thumbnail_url,video_url,storage_path,published:true});
        if(error) throw error;
      }
      resetVideoForm(); msg("ভিডিও সংরক্ষণ হয়েছে।"); await loadVideos();
    } catch(err) { msg("ভিডিও সংরক্ষণ হয়নি: "+(err.message||"অজানা সমস্যা"),true); }
  });
  $("cancel-edit").addEventListener("click",resetVideoForm);
  function resetVideoForm(){editingVideo=null;$("edit-video-id").value="";$("video-title").value="";$("video-description").value="";$("video-thumbnail").value="";$("video-file").value="";$("video-form-heading").textContent="নতুন ভিডিও আপলোড";$("cancel-edit").classList.add("hidden");}
  window.currentAdminVideos=[];
  async function loadDashboard(){
    const {data,error}=await sb.from("site_settings").select("*").eq("id",1).maybeSingle();
    if(error) msg("সেটিংস পড়া যায়নি: "+error.message,true);
    if(data){$("setting-name").value=data.site_name||"";$("setting-title").value=data.site_title||"";$("setting-description").value=data.site_description||"";}
    await loadVideos();
  }
  async function loadVideos(){
    const {data,error}=await sb.from("videos").select("*").order("created_at",{ascending:false});
    if(error){msg("ভিডিও তালিকা পড়া যায়নি: "+error.message,true);return;}
    window.currentAdminVideos=data||[];$("admin-video-total").textContent=String(data.length);
    $("admin-video-list").innerHTML=data.map(v=>`<div class="admin-video-row"><div class="admin-video-text"><strong>${esc(v.title)}</strong><span class="muted">${Number(v.views||0).toLocaleString()} views · ${v.published?"প্রকাশিত":"খসড়া"}</span></div><div class="row-actions"><button class="button button-quiet" data-edit="${v.id}">Edit</button><button class="button button-danger" data-delete="${v.id}">Delete</button></div></div>`).join("")||'<div class="empty-state">এখনো ভিডিও যোগ করা হয়নি।</div>';
    $("admin-video-list").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editVideo(b.dataset.edit));
    $("admin-video-list").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteVideo(b.dataset.delete));
  }
  function editVideo(id){const v=window.currentAdminVideos.find(x=>x.id===id);if(!v)return;editingVideo=v;$("edit-video-id").value=v.id;$("video-title").value=v.title;$("video-description").value=v.description||"";$("video-thumbnail").value=v.thumbnail_url||"";$("video-form-heading").textContent="ভিডিও এডিট";$("cancel-edit").classList.remove("hidden");window.scrollTo({top:$("video-form").getBoundingClientRect().top+window.scrollY-80,behavior:"smooth"});}
  async function deleteVideo(id){
    const v=window.currentAdminVideos.find(x=>x.id===id);if(!v||!confirm(`“${v.title}” ডিলিট করবেন?`))return;
    const {error}=await sb.from("videos").delete().eq("id",id);
    if(error){msg("ডিলিট হয়নি: "+error.message,true);return;}
    if(v.storage_path) await sb.storage.from(cfg.VIDEO_BUCKET||"tutorial-videos").remove([v.storage_path]);
    msg("ভিডিও ডিলিট হয়েছে।");await loadVideos();
  }
  if(sb) sb.auth.onAuthStateChange((_event,session)=>showDashboard(!!session));
  requireAdmin();
})();
