# Tutorial Video Platform — সেটআপ গাইড (বাংলা)

এই প্রজেক্টটি GitHub Pages-এ প্রকাশ করা যায় এমন একটি static frontend এবং Supabase backend-এর starter project।

## এতে কী আছে
- Public video feed; দর্শকের account/password নেই
- প্রথমবার নাম ইনপুট, একই ব্রাউজারে `localStorage` দিয়ে মনে রাখা
- ভিডিও share link, fullscreen ও সমর্থিত ব্রাউজারে Picture-in-Picture
- Supabase-এ ভিডিওর view counter
- Admin email + password login
- Admin dashboard থেকে website name/title/description পরিবর্তন
- Admin dashboard থেকে video upload/edit/delete
- Supabase Row Level Security (RLS) ও storage policies

## জরুরি নিরাপত্তা নোট
- `config.js`-এ শুধু Supabase Project URL ও **anon/public key** বসাবেন।
- `service_role` key কখনো HTML/JavaScript/GitHub repository-তে দেবেন না।
- Admin password browser code-এ রাখা নেই। Supabase Auth-এ admin user তৈরি করতে হবে এবং `user_roles` table-এ role দিতে হবে।
- View counter হলো সাধারণ view count; bot/refresh abuse পুরোপুরি ঠেকানোর জন্য rate limiting/Edge Function বা আলাদা analytics দরকার হতে পারে।
- এই project-এর frontend production launch-এর আগে নিজের Supabase project-এ পরীক্ষা করুন। Supabase storage plan, file limits, bandwidth, cost এবং policies আপনার ব্যবহারের সঙ্গে মিলিয়ে নিন।

## ধাপ ১ — Supabase project
1. https://supabase.com এ account/project তৈরি করুন।
2. Project Dashboard → SQL Editor → New query খুলুন।
3. `supabase/setup.sql` ফাইলের সব SQL কপি করে চালান।
4. Dashboard → Project Settings / API থেকে Project URL ও anon/public key নিন।
5. `config.js`-এ `SUPABASE_URL` ও `SUPABASE_ANON_KEY` বসান। Secret/service role key নয়।

## ধাপ ২ — Admin user
1. Supabase Dashboard → Authentication → Users থেকে admin email/password দিয়ে user তৈরি করুন।
2. ওই user-এর UUID কপি করুন।
3. SQL Editor-এ চালান (UUID বদলে নিজের UUID দিন):

```sql
insert into public.user_roles (user_id, role)
values ('PASTE-ADMIN-USER-UUID-HERE', 'admin')
on conflict (user_id) do update set role = 'admin';
```

4. `admin.html` খুলে admin email/password দিয়ে লগইন করুন।
5. চাইলে Supabase Auth settings-এ public sign-up বন্ধ রাখুন যাতে অন্য কেউ account তৈরি করতে না পারে। Admin user Dashboard থেকেই তৈরি করুন।

## ধাপ ৩ — GitHub-এ প্রকাশ
1. GitHub-এ `tutorial-video-website` নামে Public repository তৈরি করুন।
2. এই project-এর root-এর ফাইলগুলো upload করুন: `index.html`, `admin.html`, `styles.css`, `config.js`, `app.js`, `admin.js` এবং `supabase` folder।
3. Repository → Settings → Pages → Build and deployment → Deploy from a branch নির্বাচন করুন।
4. Branch `main`, folder `/(root)` নির্বাচন করে Save করুন।
5. প্রকাশিত URL-এ গিয়ে পরীক্ষা করুন। কখনো কখনো প্রকাশ হতে কয়েক মিনিট লাগে।

## ব্যবহার
- Public site: repository-এর GitHub Pages URL
- Admin page: `https://YOUR-USERNAME.github.io/tutorial-video-website/admin.html`
- দর্শকের নাম শুধু ওই browser/device-এ মনে থাকবে; অন্য device-এ নিজে থেকে sync হবে না।
- Video file bucket public playback-এর জন্য public; upload/update/delete admin role দিয়ে সীমাবদ্ধ।
- Website settings এবং video records database-এ রাখা হয়, তাই সব visitor একই updated content পাবে।

## সীমাবদ্ধতা
- সরাসরি HTML file double-click করে খুললে Supabase Auth/Storage-এর browser restrictions থাকতে পারে; GitHub Pages URL দিয়ে পরীক্ষা করুন।
- Supabase public bucket-এর video link যে কেউ দেখতে/শেয়ার করতে পারে — কারণ ভিডিওগুলো public।
- বর্তমান frontend basic upload ব্যবহার করে; বড় ফাইলের জন্য resumable upload এবং আলাদা video streaming/transcoding service প্রয়োজন হতে পারে।
- Admin sign-in uses email + password, not password-only, because secure authentication requires a user identity. Admin email can be a dedicated fixed account.
