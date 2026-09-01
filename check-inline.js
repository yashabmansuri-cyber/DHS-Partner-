
const firebaseConfig={"apiKey":"AIzaSyDySwVvKkMdVDfQZEWO4wPl7tPThrlmnqQ","authDomain":"dhs-delhi-home-service.firebaseapp.com","projectId":"dhs-delhi-home-service","storageBucket":"dhs-delhi-home-service.firebasestorage.app","messagingSenderId":"729497010980","appId":"1:729497010980:web:c861571c0192464fb329b1","measurementId":"G-7FJ4PVLR4Z"};
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.firestore(),storage=firebase.storage();
let user=null,profile=null,jobs=[],unsubs=[],online=false,currentPage='home',fcmToken='';
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const first=(o,ks,d='')=>{for(const k of ks)if(o&&o[k]!=null&&o[k]!=='')return o[k];return d};
const ts=v=>v?.toMillis?v.toMillis():v?.seconds?v.seconds*1000:new Date(v||0).getTime();
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const fmt=v=>{let d=v?.toDate?v.toDate():new Date(v);return isNaN(d)?'':d.toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})};
function splash(){if(document.getElementById('splash'))return;document.body.insertAdjacentHTML('afterbegin','<div class="splash" id="splash"><img class="splashPoster" src="images/dhs-partner-splash.png" alt="DHS Partner Welcome"><div class="splashShade"></div></div>');setTimeout(()=>document.getElementById('splash')?.remove(),3000)}
splash();
function login(){document.getElementById("root").innerHTML=`<div class="login"><div class="loginbox glass"><div class="brand"><span class="d">D</span><span class="h">H</span><span class="d">S</span></div><div class="tag">DHS PARTNER LOGIN</div><label>Email</label><input id="email" type="email" autocomplete="username" placeholder="Enter email address"><label>Password</label><input id="pass" type="password" autocomplete="current-password" placeholder="Enter password" onkeydown="if(event.key==='Enter')signIn()"><div class="loginActions"><button class="btn primary full" onclick="signIn()">Login</button><button class="btn orange full" onclick="registerPage()">New Registration</button></div><p id="err" class="dangerText"></p><div class="loginHint">Only approved DHS Partners can enter the Partner App.</div></div></div>`}
function registerPage(){document.getElementById("root").innerHTML=`<div class="login"><div class="loginbox glass"><div class="brand"><span class="d">D</span><span class="h">H</span><span class="d">S</span></div><div class="tag">NEW DHS PARTNER REGISTRATION</div>
<label>Full Name *</label><input id="rn" placeholder="Enter full name" autocomplete="name"><label>Skill / Service *</label><input id="rs" placeholder="Plumber / Electrician / AC etc." autocomplete="organization-title"><label>Mobile Number *</label><input id="rp" inputmode="tel" maxlength="10" placeholder="10 digit mobile number" autocomplete="tel"><label>Email *</label><input id="re" type="email" placeholder="Email address" autocomplete="email"><label>Create Password *</label><input id="rpass" type="password" minlength="6" placeholder="Create login password (min 6 characters)" autocomplete="new-password"><label>Address *</label><textarea id="ra" rows="2" placeholder="Full address"></textarea>
<label>Aadhaar Card Number *</label><input id="ran" inputmode="numeric" maxlength="12" placeholder="12 digit Aadhaar number"><label>PAN Card Number *</label><input id="rpn" maxlength="10" style="text-transform:uppercase" placeholder="PAN number">
<div class="loginHint" style="margin:8px 0">Aadhaar/PAN photos and selfie are not required during registration. DHS Admin can request documents separately.</div>
<button class="btn orange full mt8" onclick="registerPartner()">Submit Registration</button><button class="btn white full mt8" onclick="login()">Back to Login</button><p id="regErr" class="dangerText"></p><div class="loginHint">After submission, this app will remain on the DHS document-check waiting screen until Admin approves you.</div></div></div>`} 
async function uploadFile(file,uid,label){
 if(!file)return '';
 if(!storage) throw Error('Firebase Storage is not initialized');
 const safeName=String(file.name||'file').replace(/[^\w.\-]+/g,'_');
 const path=(String(label).startsWith('work_')?'partnerWorkProofs/':'partnerRegistrations/')+uid+'/'+label+'_'+Date.now()+'_'+safeName;
 const ref=storage.ref(path);const metadata={contentType:file.type||'application/octet-stream',customMetadata:{uploadedBy:uid,uploadType:String(label)}};
 const btn=document.getElementById('uploadCompleteBtn');
 return await new Promise((resolve,reject)=>{let settled=false;const fail=err=>{if(settled)return;settled=true;clearTimeout(timer);let msg=err?.message||String(err)||'Upload failed';if(err?.code==='storage/unauthorized')msg='Firebase Storage permission denied. Check Storage Rules.';reject(Error(msg))};const timer=setTimeout(()=>fail(Error('Upload timed out after 90 seconds.')),90000);const task=ref.put(file,metadata);task.on('state_changed',snap=>{if(btn){let kind=String(label).startsWith('work_video')?'video':'photo';btn.textContent='Uploading '+kind+' '+(snap.totalBytes?Math.round(snap.bytesTransferred/snap.totalBytes*100):0)+'%…'}},fail,async()=>{try{let url=await ref.getDownloadURL();if(settled)return;settled=true;clearTimeout(timer);resolve(url)}catch(e){fail(e)}})})
}
async function registerPartner(){try{
 const name=document.getElementById('rn')?.value.trim(),skill=document.getElementById('rs')?.value.trim(),phone=document.getElementById('rp')?.value.trim(),email=document.getElementById('re')?.value.trim().toLowerCase(),pass=document.getElementById('rpass')?.value,address=document.getElementById('ra')?.value.trim(),aadhaarNumber=document.getElementById('ran')?.value.trim(),panNumber=document.getElementById('rpn')?.value.trim().toUpperCase();
 if(!name||!skill||!phone||!email||!pass||!address||!aadhaarNumber||!panNumber)throw Error('Please fill all required details');
 if(!/^\d{10}$/.test(phone))throw Error('Please enter a valid 10 digit mobile number');
 if(!/^\d{12}$/.test(aadhaarNumber))throw Error('Please enter a valid 12 digit Aadhaar number');
 if(!/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber))throw Error('Please enter a valid PAN number');
 if(pass.length<6)throw Error('Password must be at least 6 characters');
 let cred;try{cred=await auth.createUserWithEmailAndPassword(email,pass)}catch(authErr){if(authErr.code==='auth/email-already-in-use'){cred=await auth.signInWithEmailAndPassword(email,pass)}else throw authErr} const uid=cred.user.uid;
 const now=firebase.firestore.FieldValue.serverTimestamp();
 const data={uid,name,skill,phone,email,address,aadhaarNumber,panNumber,aadhaarFront:'',aadhaarBack:'',panFront:'',panBack:'',aadhaar:'',pan:'',selfie:'',documentsRequired:false,status:'PENDING_REVIEW',partnerStatus:'PENDING_REVIEW',registrationStatus:'PENDING_REVIEW',adminReviewStatus:'PENDING',approved:false,documentStatus:'PENDING_REVIEW',applicationType:'NEW_PARTNER_REGISTRATION',sentToAdmin:true,createdAt:now,updatedAt:now};
 await db.collection('partnerRegistrations').doc(uid).set(data,{merge:true});
 // Mirror the same application for Admin builds that use partnerApplications.
 try{await db.collection('partnerApplications').doc(uid).set({...data,sourceCollection:'partnerRegistrations'},{merge:true})}catch(e){console.warn('partnerApplications mirror skipped:',e)}
 showWaiting(email,uid);
}catch(e){document.querySelector('#regErr')?.remove();let x=document.createElement('p');x.id='regErr';x.className='dangerText';x.textContent=e.code==='auth/email-already-in-use'?'This email is already registered. Please use Login.':(e.message||'Registration failed');document.querySelector('.loginbox')?.appendChild(x)}}
function showWaiting(email='',uid=user?.uid){document.getElementById("root").innerHTML=`<div class="registrationWait"><div class="waitbox"><div class="waitBrand"><span>D</span><b>H</b><span>S</span></div><div class="waitPulse"><div class="waitSpinner"></div></div><div class="waitTitle">Welcome DHS Partner</div><p class="waitSub">Waiting for approval</p><p class="waitEmail">${esc(email)}</p><p class="waitCopy">DHS Admin is checking your registration details and documents. Please keep this page open. It will automatically continue when Admin approves your partner registration.</p><div class="waitProgress"><i></i></div><span class="waitLock">🔒 Secure DHS Partner verification</span></div></div>`;if(uid)listenRegistrationApproval(uid)}
let registrationApprovalUnsub=null,workerApprovalUnsub=null,applicationApprovalUnsub=null;
function listenRegistrationApproval(uid){
 registrationApprovalUnsub?.();workerApprovalUnsub?.();applicationApprovalUnsub?.();
 const approved=async d=>{let st=String(d?.status||d?.partnerStatus||d?.registrationStatus||'').toUpperCase();if(d&&(d.approved===true||['APPROVED','JOINED','ACTIVE'].includes(st))){registrationApprovalUnsub?.();workerApprovalUnsub?.();applicationApprovalUnsub?.();registrationApprovalUnsub=workerApprovalUnsub=applicationApprovalUnsub=null;await gate(auth.currentUser||user)}else if(st==='REJECTED'){let p=document.querySelector('.registrationWait .waitSub');if(p)p.innerHTML='<b style="color:#dc2626">Registration rejected by Admin.</b>';}};
 registrationApprovalUnsub=db.collection('partnerRegistrations').doc(uid).onSnapshot(snap=>{if(snap.exists)approved(snap.data())},e=>console.warn('registration approval listener',e));
 applicationApprovalUnsub=db.collection('partnerApplications').doc(uid).onSnapshot(snap=>{if(snap.exists)approved(snap.data())},()=>{});
 workerApprovalUnsub=db.collection('workers').doc(uid).onSnapshot(snap=>{if(snap.exists)approved(snap.data())},()=>{});
}
async function signIn(){
 try{
  const email=document.querySelector('#email')?.value.trim(),pass=document.querySelector('#pass')?.value;
  if(!email||!pass) throw new Error('Email and password required');
  document.getElementById('signinPop')?.remove();
  const pop=document.createElement('div');pop.id='signinPop';pop.className='notificationPop';pop.innerHTML='<h3>Signing in…</h3><p>Checking DHS Partner account</p>';document.body.appendChild(pop);
  await auth.signInWithEmailAndPassword(email,pass);
 }catch(e){document.getElementById('signinPop')?.remove();const el=document.querySelector('#err');if(el)el.textContent=e.message||'Login failed';}
}
function shell(){document.getElementById("root").innerHTML=`<div class="app"><header class="top"><div class="logo dhsPartnerTopLogo"><span>D</span><span>H</span><span class="h">S</span><em>PARTNER</em></div><div class="topActions"><button id="topActionBtn" class="glassIcon" onclick="openNotifications()" aria-label="Notifications" title="Notifications">🔔</button></div></header>
<main class="page">
<section id="home" class="screen active"><div class="hero"><img class="avatar" id="heroPic" src="worker.png"><div class="grow"><h2 id="heroName">DHS Partner</h2><small id="heroSkill">Partner</small><div class="onlineRow"><span>Offline</span><button id="onlineSwitch" class="switch" onclick="toggleOnline()"><i></i></button><span>Online</span></div></div></div>
<div class="mapCard" id="mapCard"><div class="mapHead"><button class="mapBack" id="mapBackBtn" onclick="closeLiveMap()" aria-label="Back">‹</button><b>D<span>H</span>S <small style="font-size:10px;letter-spacing:3px">PARTNER</small></b><span class="badge ok" id="mapStatus">LIVE</span></div><div class="map homeLiveMap partnerMapShell" id="homeMap">
<iframe id="realGoogleMap" class="realMapFrame" title="DHS Partner Live Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=Delhi%20India&output=embed"></iframe>
<div class="partnerMapOverlay">
  <div class="partnerMapTop">
    <div class="partnerPerson">
      <div class="role">● Customer</div>
      <b id="mapCustomerName">Customer</b>
      <small id="mapCustomerAddress">Customer location</small>
    </div>
    <div class="partnerDistance"><strong id="mapDistance">—</strong><span>distance</span></div>
    <div class="partnerPerson right">
      <div class="role">● Partner (You)</div>
      <b id="mapPartnerName">DHS Partner</b>
      <small id="mapPartnerAddress">Your location</small>
    </div>
  </div>
  <div class="routeNavBanner" id="routeNavBanner"><div class="routeNavArrow">➤</div><div class="routeNavText"><div class="routeNavDistance" id="routeNavDistance">— km</div><div class="routeNavStreet" id="routeNavStreet">Customer Route</div><div class="routeNavSub">Follow the route to customer</div></div></div>
  <div class="routeTripCard" id="routeTripCard"><div class="routeTripMain" id="routeTripMain">— min · — km</div><div class="routeTripSub" id="routeTripSub">Going to customer</div></div>
  <div class="partnerBookingRequest" id="partnerBookingRequest">
    <div class="partnerBookingRequestHead"><span class="requestTitle">NEW BOOKING</span><span class="requestTimer" id="requestTimer">15s</span></div>
    <div class="partnerBookingRequestBody"><b id="requestCustomerName">Customer</b><div class="requestService" id="requestService">Service</div><div class="requestDistance" id="requestDistance">4 min · 4.1 km away</div></div>
    <button class="requestAccept" id="requestAcceptBtn">Accept</button>
  </div>
  <div class="partnerMapTools">
    <button class="mapTool" onclick="toggleMapMode()" id="mapModeBtn">2D</button>
    <button class="mapTool" onclick="centerPartnerMap()" aria-label="My Location">⌾</button>
    <button class="mapTool mapCompass" onclick="centerPartnerMap()" aria-label="Compass">🧭</button>
  </div>
  <svg class="partnerRoute" viewBox="0 0 430 560" preserveAspectRatio="none">
    <path class="partnerRouteGlow" d="M 70 400 C 110 360, 145 380, 180 330 S 235 270, 290 245 S 335 205, 370 150"></path>
    <path id="routePath" d="M 70 400 C 110 360, 145 380, 180 330 S 235 270, 290 245 S 335 205, 370 150" style="display:none"></path>
  </svg>
  <div id="bikeRider" class="bikeRider" style="display:none">🏍️</div>
  <div id="mePin" class="partnerMapPin me"><span>👤</span></div>
  <div id="jobPin" class="partnerMapPin customer" style="display:none"><span>👤</span></div>
  <div class="partnerMapLabel customer" id="mapCustomerLabel">Customer 😄</div>
  <div class="partnerMapLabel me">You (Partner) 😄</div>
  <div class="partnerMapJobCard"><b id="mapService">Waiting for assigned job</b><span class="partnerMapStatus" id="mapLiveStatus">LIVE</span><small id="mapNote">Accept a new booking to start live navigation.</small></div>
  <div class="partnerMapBottom">
    <button class="mapAction call" id="mapCallBtn" onclick="callActiveCustomer()">☎ Call Customer</button>
    <button class="mapAction nav" onclick="navigateToCustomer()">➤ Navigate</button>
  </div>
  <div id="arrivalActions" style="display:none"></div>
</div>
</div></div>
<div class="sectionTitle">Live Work Tracking</div><div class="card"><div class="muted">Accept a new booking to open this live customer route. Call and Navigate are available directly on the map.</div></div></section>
<section id="earnings" class="screen"><div class="sectionTitle">Earnings</div><div class="statgrid"><div class="stat" style="cursor:pointer" onclick="document.getElementById('completedList').scrollIntoView({behavior:'smooth'})"><small>Total Jobs Completed</small><strong id="statJobs">0</strong></div><div class="stat"><small>Total Earning</small><strong id="statPay">₹0</strong></div><div class="stat"><small>This Week Earning</small><strong id="statBills">₹0</strong></div><div class="stat"><small>Accepted Leads</small><strong id="statAccepted">0</strong></div></div><div class="sectionTitle">Completed Jobs</div><div id="completedList"></div></section>
<section id="bills" class="screen"><div class="sectionTitle">▤ Create Bill</div><div id="billList"></div><button class="btn white full mt8" onclick="resetBill(true);window.scrollTo({top:0,behavior:'smooth'})">＋ New Bill</button>
<div class="bill-editor">
<div class="bill-grid"><div class="bill-field"><label>Customer Name *</label><input id="name"></div><div class="bill-field"><label>Customer Number *</label><input id="phone" type="tel"></div><div class="bill-field"><label>Invoice No.</label><input id="invoice"></div><div class="bill-field"><label>Date</label><input id="date" type="date"></div><div class="bill-field bill-full"><label>Service Address *</label><input id="address"></div><div class="bill-field"><label>Service Type *</label><textarea id="service"></textarea></div></div>
<div class="bill-items-title">WORK / ITEMS</div><div class="bill-item-head"><div>#</div><div>Description *</div><div>Details</div><div>Qty.</div><div>Rate (₹)</div><div>Amount (₹)</div><div>Action</div></div><div id="items"></div><button class="bill-add" onclick="addItem()">＋ Add Item</button><div class="bill-bottom"><div class="bill-field"><label>Notes</label><textarea id="notes" class="bill-notes">• All work has been completed successfully.
• Please ensure payment is made upon completion of service.
• Thank you for choosing Delhi Home Service.</textarea></div><div class="bill-summary"><div class="bill-sumline"><span>Sub Total</span><b id="subtotal">₹0.00</b></div><div class="bill-sumline"><span>Discount</span><input id="discount" type="number" value="0" min="0" oninput="calc()"></div><div class="bill-sumline bill-sumtotal"><span>Total Amount</span><span id="total">₹0.00</span></div><div class="bill-sumline"><span>Payment Status</span><select id="paymentStatus"><option>PAID</option><option>PENDING</option></select></div><div class="bill-sumline"><span>Payment Method</span><select id="paymentMethod"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Razorpay</option></select></div><div class="bill-actions"><button class="bill-generate" onclick="generate()">▣ Generate Bill</button><button class="bill-reset" onclick="resetBill()">Reset</button></div></div></div></div>
<div class="bill-preview-title">INVOICE PREVIEW</div><div class="bill-preview-wrap"><div id="invoice" class="dhs-invoice"><div class="dhs-inv-head"><div><div class="dhs-brand-logo">D H <span>S</span></div><div class="dhs-company">Delhi Home Service</div><div class="dhs-tag">Professional Home Repair Experts</div></div><div class="dhs-inv-meta"><b>Invoice No:</b> <span id="pInvoice"></span><br><b>Date:</b> <span id="pDate"></span></div></div><div class="dhs-section-title">SERVICE INVOICE</div><div class="dhs-info-area"><div class="dhs-customer-info"><div class="dhs-crow"><b>Customer Name</b><span>:</span><span id="pName">—</span></div><div class="dhs-crow"><b>Customer Number</b><span>:</span><span id="pPhone">—</span></div><div class="dhs-crow"><b>Service Address</b><span>:</span><span id="pAddress">—</span></div><div class="dhs-crow"><b>Service Type</b><span>:</span><span id="pService">—</span></div></div><div class="dhs-contact-area"><div class="dhs-review-box"><div style="font-size:12px">Review us on</div><div class="dhs-google"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></div><img class="dhs-qr" src="images/review-qr.png" alt="Google Review QR"></div><div class="dhs-contacts"><div class="dhs-contact"><div class="dhs-icon">✉</div><div><b>Email</b>delhihomeservice09@gmail.com</div></div><div class="dhs-contact"><div class="dhs-icon">◎</div><div><b>Website</b>delhihomeservices.netlify.app</div></div><div class="dhs-contact"><div class="dhs-icon">☎</div><div><b>Call / WhatsApp</b>97184 48382</div></div></div></div></div><table class="dhs-table"><thead><tr><th>#</th><th>Description</th><th>Details</th><th>Qty.</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead><tbody id="pItems"></tbody></table><div class="dhs-bottom-area"><div class="dhs-notes-area"><h4>Notes:</h4><ul id="pNotes"></ul></div><div class="dhs-signature-area"><div class="dhs-auth">Authorized Signature</div><div class="dhs-company-small">Delhi Home Service</div><img class="dhs-signature-img" src="images/dhs-signature.png" alt="DHS Authorized Signature"><img class="dhs-stamp-img" src="images/dhs-stamp.png" alt="DHS Stamp"></div><div class="dhs-totals"><div class="dhs-tline"><span>Sub Total</span><b id="pSubtotal">₹0.00</b></div><div class="dhs-tline"><span>Discount</span><b id="pDiscount">- ₹0.00</b></div><div class="dhs-ttotal"><span>Total Amount</span><span id="pTotal">₹0.00</span></div><div class="dhs-words" id="pWords">(Rupees Zero Only)</div><div class="dhs-status" id="pStatus">Payment Status: PAID</div></div></div></div><div class="dhs-footer">✓ Verified Professionals <span>|</span> ✓ On Time Service <span>|</span> ✓ Trusted by Customers <span>|</span> ✓ Quality Assured</div></div><div class="bill-preview-actions"><button class="bill-print" onclick="printBill()">🖨 Print / PDF</button><button class="bill-download" onclick="downloadPDF()">⬇ Download PDF</button><button style="background:#0a9d42;color:#fff" onclick="payCash()">💵 Pay Cash</button><button style="background:#6d28d9;color:#fff" onclick="payQR()">▣ Pay QR</button><button class="bill-close" onclick="document.getElementById('invoice')?.scrollIntoView({behavior:'smooth'})">View Bill</button></div></div></section>
<section id="settings" class="screen settingsScreen">
<div class="settingsHead">
<button class="settingsBack" onclick="go('profile',document.querySelector('[data-page="profile"]'))" aria-label="Back">‹</button>
<div><div class="settingsTitle">Settings</div><small class="muted">DHS Partner App Settings</small></div>
</div>
<div class="settingsCard">
<button class="settingsItem help" onclick="callDhsHelp()">
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.3-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z"/></svg>
<span class="siText"><b>Call Help — DHS</b><small>97184 48382</small></span><span class="chev">›</span>
</button>
</div>
<div class="settingsCard">
<button class="settingsItem danger" onclick="resetData()">
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
<span class="siText"><b>Reset All Data</b><small>Password required. Clears DHS Partner app data for the signed-in partner.</small></span><span class="chev">›</span>
</button>
</div>
<div class="settingsCard">
<button class="settingsItem logout" onclick="auth.signOut()">
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></svg>
<span class="siText"><b>Logout</b><small>Sign out from DHS Partner</small></span><span class="chev">›</span>
</button>
</div>
<div class="card"><p class="dangerText" style="margin:0">Important: a true all-partner/global reset must be authorized from DHS Admin/Firebase server-side. The Partner app only resets the currently signed-in partner's data.</p></div>
</section>

<section id="profile" class="screen">
<div class="card center profileHeroCard"><img id="profilePic" class="avatar" style="width:92px;height:92px" src="worker.png"><h2 id="profileName">Partner</h2><p id="profileSkill" class="muted">Skill</p><button class="btn white" onclick="editProfile()">Edit Profile</button></div>
<div class="card"><div class="row"><div class="grow"><h3>All Jobs</h3><p class="muted">All Admin-sent bookings are shown here.</p></div><span class="badge" id="jobCountBadge">0</span></div><div id="allJobsList" class="allJobsList"></div></div>
</section>
</main><nav class="bottom"><button class="active" data-page="home" onclick="go('home',this)"><span>⌂</span>Home</button><button data-page="earnings" onclick="go('earnings',this)"><span>◈</span>Earning</button><button data-page="bills" onclick="newBill()"><span>▣</span>Bill</button><button data-page="profile" onclick="go('profile',this)"><span>◎</span>Profile</button></nav></div>`;renderProfile();updateTopAction();listenJobs();listenBills();enableFCM();getLocation();setTimeout(processPushAction,900)}
function updateTopAction(){const b=document.getElementById('topActionBtn');if(!b)return;const isProfile=currentPage==='profile';b.innerHTML=isProfile?'<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.7-1.7.1-.1A1.7 1.7 0 0 0 6.9 15a1.7 1.7 0 0 0-1.5-1h-.2v-2.4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z"/></svg>':'🔔';b.setAttribute('aria-label',isProfile?'Settings':'Notifications');b.title=isProfile?'Settings':'Notifications';b.onclick=isProfile?()=>go('settings',b):openNotifications()}
function go(page,btn){currentPage=page;document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));document.getElementById(page)?.classList.add('active');document.querySelectorAll('.bottom button').forEach(x=>x.classList.remove('active'));if(page!=='settings')btn?.classList.add('active');if(page==='settings')document.querySelector('[data-page="profile"]')?.classList.add('active');updateTopAction();if(page==='earnings')renderEarnings();if(page==='bills'){renderBills();document.getElementById('billList')?.scrollIntoView({block:'start'})}requestAnimationFrame(()=>{document.documentElement.scrollTop=0;document.body.scrollTop=0;window.scrollTo(0,0)})}
function renderProfile(){let p=profile||{};document.querySelector('#heroName').textContent=first(p,['name'],user?.displayName||'DHS Partner');document.querySelector('#heroSkill').textContent=first(p,['skill','service'],'Partner');document.querySelector('#profileName').textContent=first(p,['name'],user?.displayName||'Partner');document.querySelector('#profileSkill').textContent=first(p,['skill','service'],'Skill');let pic=first(p,['profilePhoto','profilePic','selfie','photoURL','photo','imageUrl'],'worker.png');document.querySelector('#heroPic').src=pic;document.querySelector('#profilePic').src=pic;let st=String(p.status||'offline').toLowerCase();online=['online','active','available','working'].includes(st);document.querySelector('#onlineSwitch').classList.toggle('on',online)}
function jobState(j){return String(first(j,['partnerStatus','Stuts','bookingStatus','status'],'PENDING_ACCEPT')).toUpperCase()}
function assignedToMe(d){let email=user?.email?.toLowerCase(),uid=user?.uid;let ids=[d.workeruid,d.workerUid,d.partnerUid,d.partnerId,d.assignedPartnerId,d.assignedTo,d.workerid,d.partnerEmail,d.workeremail,d.assignedEmail,d.workerEmail].map(x=>String(x||'').toLowerCase());return ids.includes(String(uid||'').toLowerCase())||ids.includes(email)||d.SentToPartner===true||d.sentToPartner===true}
function listenJobs(){
 unsubs.forEach(x=>x());unsubs=[];jobs=[];const seen=new Map();let initialJobWindow=true;setTimeout(()=>initialJobWindow=false,2500);
 const process=(s)=>{s.docChanges().forEach(ch=>{if(ch.type==='removed')seen.delete(ch.doc.id);else{let d={id:ch.doc.id,...ch.doc.data()};if(assignedToMe(d))seen.set(ch.doc.id,d)}});let oldIds=new Set(jobs.map(x=>x.id));jobs=[...seen.values()].sort((a,b)=>ts(b.createdAt)-ts(a.createdAt));renderJobs();if(!initialJobWindow&&online){jobs.filter(j=>!oldIds.has(j.id)&&['NEW','PENDING_ACCEPT'].includes(jobState(j))).forEach(j=>showNewBookingPopup(j))}};
 const attach=q=>{try{let u=q.onSnapshot(process,e=>console.warn('job listener',e));unsubs.push(u)}catch(e){console.warn(e)}};
 if(user?.uid){attach(db.collection('partnerJobs').where('workeruid','==',user.uid));attach(db.collection('partnerJobs').where('partnerId','==',user.uid));attach(db.collection('partnerJobs').where('partnerEmail','==',user.email));attach(db.collection('partnerJobs').where('workeremail','==',user.email));attach(db.collection('partnerJobs').where('SentToPartner','==',true));attach(db.collection('partnerJobs').where('sentToPartner','==',true));attach(db.collection('bookings').where('workeruid','==',user.uid));attach(db.collection('bookings').where('workeremail','==',user.email));}
 setTimeout(()=>{if(!jobs.length){db.collection('partnerJobs').limit(100).get().then(s=>{s.docs.forEach(d=>{let x={id:d.id,...d.data()};if(assignedToMe(x))jobs.push(x)});jobs.sort((a,b)=>ts(b.createdAt)-ts(a.createdAt));renderJobs()}).catch(()=>{})}},1200);setTimeout(()=>{let pending=jobs.find(x=>['PENDING_ACCEPT','NEW'].includes(jobState(x)));if(online&&pending&&!document.getElementById('np'))showNewBookingPopup(pending)},3200);
}
function renderJobs(){
 const el=document.querySelector('#allJobsList');if(!el)return;
 document.querySelector('#jobCountBadge').textContent=jobs.length;
 el.innerHTML=jobs.length?jobs.map(jobCard).join(''):'<div class="empty">No Admin assigned bookings yet.</div>';
 let j=jobs.find(x=>['PENDING_ACCEPT','NEW'].includes(jobState(x)));if(j){setMapJob(j)}
}
function jobCard(j){let st=jobState(j),accepted=['ACCEPTED','ON_THE_WAY','WORKING','ARRIVED'].includes(st),customer=first(j,['costumername','customerName','customer'],'Customer'),service=first(j,['service','serviceType'],'Service'),addr=first(j,['costumerAddress','customerAddress','address'],'');return `<div class="card"><div class="row"><div class="grow"><div class="bookingTitle">${esc(customer)}</div><div class="muted">${esc(service)}</div><div class="muted">${esc(addr)}</div></div><span class="badge ${accepted||st==='COMPLETED'?'ok':st==='REJECTED'?'no':''}">${esc(st)}</span></div><div class="actions">${st==='PENDING_ACCEPT'||st==='NEW'?`<button class="btn green" onclick="jobDecision('${j.id}','ACCEPTED')">Accept</button><button class="btn danger" onclick="jobDecision('${j.id}','REJECTED')">Reject</button>`:''}${accepted&&st!=='ARRIVED'?`<button class="btn orange" onclick="startJob('${j.id}')">Start Job</button>`:''}${st==='ARRIVED'?`<button class="btn orange" onclick="startWorkFromMap()">Start Work</button>`:''}<a class="btn white" href="tel:${esc(first(j,['costumerphone','customerPhone','phone'],''))}">📞 Call Customer</a><button class="btn white" onclick="openMapById('${esc(j.id)}')">📍 Map</button></div></div>`}
async function syncPartnerAdmin(extra={}){
 try{
  const c=profile?.collection||'workers',id=profile?.id||user?.uid;
  if(!user||!id)return;
  const patch={uid:user.uid,email:user.email,workeremail:user.email,adminSyncAt:firebase.firestore.FieldValue.serverTimestamp(),...extra};
  await db.collection(c).doc(id).set(patch,{merge:true});
  await db.collection('partnerActivity').add({partnerId:user.uid,workerid:profile?.id||user.uid,partnerName:first(profile,['name'],user.email),partnerEmail:user.email,...extra,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
 }catch(e){console.warn('admin sync failed',e)}
}

let alertLoopTimer=null;
function playAlert(){
 try{
  const a=document.querySelector('#alert');
  if(a){a.currentTime=0;const p=a.play();p?.catch(()=>{});}
  if(navigator.vibrate)navigator.vibrate([500,120,500,120,900,150,700]);
  clearTimeout(alertLoopTimer);
  let count=0;
  alertLoopTimer=setInterval(()=>{
    count++;
    if(navigator.vibrate)navigator.vibrate([450,120,450]);
    if(a){a.currentTime=0;a.play()?.catch(()=>{});}
    if(count>=4){clearInterval(alertLoopTimer);alertLoopTimer=null;}
  },1800);
 }catch(e){}
}
function showNewBookingPopup(j){
 if(!online)return;
 if(!j?.id)return;
 const overlay=document.querySelector('#homeMap .partnerMapOverlay');
 const card=document.getElementById('partnerBookingRequest');
 if(!overlay||!card)return;
 clearTimeout(window.dhsRequestTimer);
 clearInterval(window.dhsRequestCountdown);
 const customer=first(j,['costumername','customerName','customer'],'Customer');
 const service=first(j,['service','serviceType'],'Service');
 const distanceRaw=first(j,['distance','distanceKm','km','distanceInKm'],'');
 const eta=first(j,['distanceText','pickupDistance','eta','customerDistance'],'');
 let distance=distanceRaw ? (String(distanceRaw).toLowerCase().includes('km')?String(distanceRaw):String(distanceRaw)+' km') : '';
 if(eta) distance=String(eta);
 if(!distance) distance='Customer distance unavailable';
 notifiedJobs.add(String(j.id));
 playAlert();
 overlay.classList.remove('routeActive');
 overlay.classList.add('requestActive');
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 set('requestCustomerName',customer);set('requestService',service);set('requestDistance',distance+' away');
 const btn=document.getElementById('requestAcceptBtn');
 if(btn){btn.onclick=async()=>{clearTimeout(window.dhsRequestTimer);clearInterval(window.dhsRequestCountdown);overlay.classList.remove('requestActive');await jobDecision(j.id,'ACCEPTED')}}
 let left=15;set('requestTimer',left+'s');
 window.dhsRequestCountdown=setInterval(()=>{left--;set('requestTimer',Math.max(left,0)+'s');if(left<=0)clearInterval(window.dhsRequestCountdown)},1000);
 window.dhsRequestTimer=setTimeout(()=>{
   clearInterval(window.dhsRequestCountdown);
   overlay.classList.remove('requestActive');
   card.style.display='none';
   set('requestTimer','15s');
 },15000);
 card.style.display='block';
}
function showAcceptedPopup(j){document.getElementById('acceptedPop')?.remove();let customer=first(j,['costumername','customerName'],'Customer'),service=first(j,['service','serviceType'],'Service'),addr=first(j,['costumerAddress','customerAddress','address'],''),phone=first(j,['costumerphone','customerPhone','phone'],'');document.body.insertAdjacentHTML('beforeend',`<div class="modalBack" id="acceptedPop"><div class="modal workGlass"><div class="modalHead"><h3>Booking Accepted</h3><button class="close" onclick="document.getElementById('acceptedPop')?.remove()">✕</button></div><div class="jobDetails"><div>Name: <b>${esc(customer)}</b></div><div>Address: <b>${esc(addr)}</b></div><div>Service: <b>${esc(service)}</b></div><div>Phone: <b>${esc(phone)}</b></div></div><div class="actions"><a class="btn green" href="tel:${esc(phone)}">📞 Call Customer</a><button class="btn orange" onclick="document.getElementById('acceptedPop')?.remove();startJob('${esc(j.id)}')">Start Job</button></div></div></div>`)}
async function jobDecision(id,status){
 try{
  let j=jobs.find(x=>x.id===id)||{};
  if(!j.id){const snap=await db.collection('partnerJobs').doc(id).get();if(snap.exists)j={id:snap.id,...snap.data()};}
  const patch={Stuts:status,partnerStatus:status,bookingStatus:status==='ACCEPTED'?'ACCEPTED':status==='REJECTED'?'REJECTED':'NEW',workeruid:user.uid,workeremail:user.email,partnerId:user.uid,partnerEmail:user.email,partnerName:first(profile,['name'],user?.displayName||user?.email||'Partner'),partnerPhoto:first(profile,['profilePhoto','profilePic','selfie','photoURL','photoUrl','photo','imageUrl','image'],''),partnerAge:first(profile,['age','partnerAge'],''),UpdatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:user.uid,partnerUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  await db.collection('partnerJobs').doc(id).set(patch,{merge:true});
  try{await db.collection('bookings').doc(id).set({partnerStatus:status,bookingStatus:status==='ACCEPTED'?'ACCEPTED':status==='REJECTED'?'REJECTED':'NEW',workeruid:user.uid,workeremail:user.email,partnerId:user.uid,partnerEmail:user.email,UpdatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})}catch(e){}
  try{await db.collection('notifications').add({type:'partner_booking_status',bookingId:id,partnerId:user.uid,workerid:profile?.id||user.uid,status,customerName:first(j,['costumername','customerName'],'Customer'),service:first(j,['service'],'Service'),createdAt:firebase.firestore.FieldValue.serverTimestamp()})}catch(e){}
  await syncPartnerAdmin({lastAction:status==='ACCEPTED'?'ACCEPT_BOOKING':'REJECT_BOOKING',currentBookingId:id,currentBookingStatus:status});
  if(status==='ACCEPTED'){
    document.getElementById('np')?.remove();document.querySelector('#homeMap .partnerMapOverlay')?.classList.remove('requestActive');document.getElementById('partnerBookingRequest')?.style.setProperty('display','none');
    activeRouteJob=j;
    setMapJob(j);
    openLiveMap(j);
    startRouteAnimation(j);
    toast('Booking accepted • Live map opened');
  }else{document.getElementById('np')?.remove();toast('Booking rejected')}
 }catch(e){toast(e.message||'Booking action failed')}
}
let activeRouteJob=null,partnerLat=null,partnerLng=null,arrivalTimer=null;const notifiedJobs=new Set();
function openLiveMap(j){
 const card=document.getElementById('mapCard');
 if(!card)return;
 card.classList.add('mapFullHost');
 document.getElementById('homeMap')?.classList.add('fullscreenMap');
 document.body.classList.add('liveMapOpen');
 document.querySelector('#homeMap .partnerMapOverlay')?.classList.remove('requestActive');
 setMapJob(j||activeRouteJob);
}
function closeLiveMap(){
 document.getElementById('mapCard')?.classList.remove('mapFullHost');
 document.getElementById('homeMap')?.classList.remove('fullscreenMap');
 document.body.classList.remove('liveMapOpen');
 document.querySelector('#homeMap .partnerMapOverlay')?.classList.remove('routeActive','requestActive');
 clearTimeout(window.dhsRequestTimer);clearInterval(window.dhsRequestCountdown);
}
function setMapJob(j){
 if(!j)return;
 activeRouteJob=j;
 let addr=first(j,['costumerAddress','customerAddress','address'],'Customer location');
 let lat=first(j,['customerLat','costumerLat','destinationLat','customerLatitude'],'');
 let lng=first(j,['customerLng','costumerLng','destinationLng','customerLongitude'],'');
 let customer=first(j,['costumername','customerName','customer'],'Customer');
 let service=first(j,['service','serviceType'],'Service');
 let phone=first(j,['costumerphone','customerPhone','phone'],'');
 let partnerName=first(profile,['name'],user?.displayName||'DHS Partner');
 let partnerAddr=first(profile,['address','area','location'],'Your location');
 let iframe=document.getElementById('realGoogleMap');
 if(iframe){let q=(lat&&lng)?`${lat},${lng}`:addr;iframe.src='https://www.google.com/maps?q='+encodeURIComponent(q)+'&output=embed';iframe.dataset.destination=(lat&&lng)?lat+','+lng:addr}
 const set=(id,v)=>{let e=document.getElementById(id);if(e)e.textContent=v};
 set('mapCustomerName',customer);set('mapCustomerAddress',addr);set('mapPartnerName',partnerName);set('mapPartnerAddress',partnerAddr);set('mapService',service);set('mapCustomerLabel',customer+' 😄');
 let cb=document.getElementById('mapCallBtn');if(cb)cb.dataset.phone=phone;
 let note=document.getElementById('mapNote');if(note)note.textContent='📍 '+addr;
 let pin=document.getElementById('jobPin');if(pin)pin.style.display='block';
 updateMapDistance(j);
}
function updateMapDistance(j){
 let d=first(j,['distance','distanceKm','km','distanceInKm'],'');
 let el=document.getElementById('mapDistance');
 if(el)el.textContent=d?(String(d).toLowerCase().includes('km')?d:String(d)+' km'):'—';
}
function callActiveCustomer(){
 let j=activeRouteJob||jobs.find(x=>['ACCEPTED','ON_THE_WAY','ARRIVED','WORKING'].includes(jobState(x)));
 let phone=j?first(j,['costumerphone','customerPhone','phone'],''):document.getElementById('mapCallBtn')?.dataset.phone||'';
 phone=String(phone||'').replace(/[^0-9+]/g,'');
 if(phone){window.location.href='tel:'+phone}else toast('Customer phone number not available');
}
function navigateToCustomer(){
 let j=activeRouteJob||jobs.find(x=>['ACCEPTED','ON_THE_WAY','ARRIVED','WORKING'].includes(jobState(x)));
 if(!j){toast('No active customer job');return}
 let lat=first(j,['customerLat','costumerLat','destinationLat','customerLatitude'],'');
 let lng=first(j,['customerLng','costumerLng','destinationLng','customerLongitude'],'');
 let addr=first(j,['costumerAddress','customerAddress','address'],'Delhi');
 let dest=(lat&&lng)?encodeURIComponent(lat+','+lng):encodeURIComponent(addr);
 window.open('https://www.google.com/maps/dir/?api=1&destination='+dest+'&travelmode=driving','_blank');
}
function centerPartnerMap(){
 try{navigator.geolocation?.getCurrentPosition(pos=>{partnerLat=pos.coords.latitude;partnerLng=pos.coords.longitude;toast('My location updated');document.getElementById('mePin')?.style.setProperty('right','19%');},()=>toast('Location permission required'),{enableHighAccuracy:true,timeout:8000})}catch(e){}
}
function toggleMapMode(){
 let f=document.getElementById('realGoogleMap'),b=document.getElementById('mapModeBtn');if(!f)return;
 let mode=f.dataset.mapmode==='3d'?'2d':'3d';
 f.dataset.mapmode=mode;
 f.style.filter=mode==='3d'?'saturate(1.35) contrast(1.12) brightness(.72)':'saturate(1.1) contrast(1.02) brightness(.82)';
 if(b)b.textContent=mode==='3d'?'3D':'2D';
}
function startRouteAnimation(j){
 openLiveMap(j);
 const path=document.getElementById('routePath');if(path){path.style.display='block';path.style.animation='none';void path.offsetWidth;path.style.animation='routeDash 1.1s linear infinite';}
 const bike=document.getElementById('bikeRider');if(bike){bike.style.display='block';bike.style.animation='none';void bike.offsetWidth;bike.style.animation='rideRoute 9s linear infinite';}
 document.querySelector('#homeMap .partnerMapOverlay')?.classList.remove('requestActive');document.querySelector('#homeMap .partnerMapOverlay')?.classList.add('routeActive');document.getElementById('partnerBookingRequest')?.style.setProperty('display','none');
 let dist=first(j,['distance','distanceKm','km','distanceInKm'],'—');if(String(dist).toLowerCase().indexOf('km')<0&&dist!=='—')dist=String(dist)+' km';
 let street=first(j,['customerStreet','street','road','costumerAddress','customerAddress','address'],'Customer Route');
 let eta=first(j,['eta','duration','travelTime','pickupEta'],'');
 const rs=(id,v)=>{let e=document.getElementById(id);if(e)e.textContent=v};rs('routeNavDistance',dist);rs('routeNavStreet',street);rs('routeTripMain',(eta?eta+' · ':'')+dist);rs('routeTripSub','Going to '+first(j,['costumername','customerName','customer'],'customer'));
 document.getElementById('mapStatus').textContent='ON THE WAY';document.getElementById('mapLiveStatus').textContent='ON THE WAY';clearTimeout(arrivalTimer);
 let note=document.getElementById('mapNote');if(note)note.innerHTML='🧭 <b>On the way to customer</b>';
}
async function markArrived(id){
 let j=jobs.find(x=>x.id===id);if(!j)return;
 document.getElementById('bikeRider').style.display='none';document.getElementById('routePath').style.animation='none';
 document.getElementById('mapStatus').textContent='ARRIVED';document.getElementById('mapLiveStatus').textContent='ARRIVED';
 let note=document.getElementById('mapNote');if(note)note.innerHTML='📍 <b>Customer location reached</b>';
 try{await db.collection('partnerJobs').doc(id).set({Stuts:'ARRIVED',partnerStatus:'ARRIVED',bookingStatus:'ARRIVED',arrivedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})}catch(e){}
}
function startWorkFromMap(){let j=activeRouteJob||jobs.find(x=>jobState(x)==='ARRIVED');if(!j)return;showWorkPopup(j)}
let workCapturePhoto=null,workCaptureVideo=null,cameraStream=null,cameraRecorder=null,cameraChunks=[],cameraMode='photo';
function completeJob(id){let j=jobs.find(x=>x.id===id);if(j)showWorkPopup(j)}
let workTimer=null,workSeconds=0;
function showWorkPopup(j){workSeconds=0;clearInterval(workTimer);showModal(`<div class="modalHead"><h3>🔧 Work Started</h3><button class="close" onclick="closeModal();clearInterval(workTimer)">✕</button></div><div class="workTimer" id="workTimer">00:00:00</div><div class="workerAnim">👷‍♂️🔨</div><p class="center muted">DHS Partner is working… timer is recording automatically.</p><button class="btn orange full mt8" onclick="openWorkProof('${esc(j.id)}')">Complete Work</button>`);workTimer=setInterval(()=>{workSeconds++;let h=String(Math.floor(workSeconds/3600)).padStart(2,'0'),m=String(Math.floor(workSeconds%3600/60)).padStart(2,'0'),sec=String(workSeconds%60).padStart(2,'0');let el=document.getElementById('workTimer');if(el)el.textContent=`${h}:${m}:${sec}`},1000)}
function openWorkProof(id){clearInterval(workTimer);let j=jobs.find(x=>x.id===id);if(!j)return;workCapturePhoto=null;workCaptureVideo=null;showModal(`<div class="modalHead"><h3>Work Proof</h3><button class="close" onclick="closeModal()">✕</button></div><p class="muted">Maximum 10 photos and 2 videos. One or more proof files required.</p><div class="proofGrid"><div class="proofCard"><div class="proofTitle">Photos <span id="photoCount">0/10</span></div><button class="proofBtn" onclick="openDhsCamera('photo')">📷<span>Camera</span></button><span id="photoStatus" class="proofStatus">No photos yet</span><div id="photoThumbs"></div></div><div class="proofCard"><div class="proofTitle">Videos <span id="videoCount">0/2</span></div><button class="proofBtn" onclick="openDhsCamera('video')">🎥<span>Video Camera</span></button><span id="videoStatus" class="proofStatus">No videos yet</span><div id="videoThumbs"></div></div></div><button id="uploadCompleteBtn" class="btn orange full mt8" onclick="saveWorkProof('${esc(id)}')">Complete Work</button>`);workPhotoFiles=[];workVideoFiles=[]}
let workPhotoFiles=[],workVideoFiles=[];
async function openDhsCamera(mode){cameraMode=mode;cameraChunks=[];if(!navigator.mediaDevices?.getUserMedia){toast('Camera ke liye HTTPS/app permission required hai.');return}document.getElementById('dhsCamera')?.remove();let count=mode==='photo'?workPhotoFiles.length:workVideoFiles.length;if((mode==='photo'&&count>=10)||(mode==='video'&&count>=2)){toast(mode==='photo'?'Photo limit 10 reached':'Video limit 2 reached');return}let label=mode==='photo'?'Take Work Photo':'Record Work Video';document.body.insertAdjacentHTML('beforeend',`<div class="camera-modal" id="dhsCamera"><div class="camera-top"><h3>📷 ${label}</h3><button class="camera-close" onclick="closeDhsCamera()">✕</button></div><div class="camera-stage"><video id="cameraLive" autoplay playsinline muted></video><div class="camera-hint">DHS Partner in-app camera</div></div><div class="camera-controls"><button class="camera-secondary" onclick="switchCameraFacing()">↻ Flip</button><button id="cameraAction" class="camera-action ${mode==='video'?'record':''}" onclick="captureDhsCamera()">${mode==='video'?'●':'◉'}</button></div></div>`);try{cameraStream=await navigator.mediaDevices.getUserMedia(mode==='video'?{video:{facingMode:{ideal:'environment'}},audio:true}:{video:{facingMode:{ideal:'environment'}},audio:false});let v=document.getElementById('cameraLive');v.srcObject=cameraStream;await v.play()}catch(e){closeDhsCamera();toast('Camera permission/error: '+(e.message||'Camera open nahi hui'))}}
async function switchCameraFacing(){
 if(!cameraStream)return;const tracks=cameraStream.getVideoTracks();const current=tracks[0]?.getSettings()?.facingMode||'environment';tracks.forEach(t=>t.stop());
 try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:current==='environment'?'user':'environment'}},audio:cameraMode==='video'});document.getElementById('cameraLive').srcObject=cameraStream;}catch(e){toast('Camera flip failed')}
}
function captureDhsCamera(){let v=document.getElementById('cameraLive');if(!v||!cameraStream)return;if(cameraMode==='photo'){if(workPhotoFiles.length>=10){toast('Photo limit 10 reached');return}let c=document.createElement('canvas');c.width=v.videoWidth||1080;c.height=v.videoHeight||1920;c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(blob=>{if(!blob)return;workPhotoFiles.push(new File([blob],`DHS-Work-Photo-${Date.now()}.jpg`,{type:'image/jpeg'}));closeDhsCamera();updateProofCounts()},'image/jpeg',.92);return}let btn=document.getElementById('cameraAction');if(!cameraRecorder||cameraRecorder.state==='inactive'){if(workVideoFiles.length>=2){toast('Video limit 2 reached');return}cameraChunks=[];let opts={};if(MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))opts.mimeType='video/webm;codecs=vp9';else if(MediaRecorder.isTypeSupported('video/webm'))opts.mimeType='video/webm';try{cameraRecorder=new MediaRecorder(cameraStream,opts)}catch(e){toast('Video recording supported nahi hai');return}cameraRecorder.ondataavailable=e=>{if(e.data?.size)cameraChunks.push(e.data)};cameraRecorder.onstop=()=>{let type=cameraRecorder.mimeType||'video/webm';workVideoFiles.push(new File([new Blob(cameraChunks,{type})],`DHS-Work-Video-${Date.now()}.webm`,{type}));closeDhsCamera();updateProofCounts()};cameraRecorder.start(250);btn.textContent='■';btn.classList.add('record');toast('Recording started')}else{cameraRecorder.stop();btn.textContent='Saving…';btn.disabled=true}}
function updateProofCounts(){let p=document.getElementById('photoCount'),v=document.getElementById('videoCount'),ps=document.getElementById('photoStatus'),vs=document.getElementById('videoStatus');if(p)p.textContent=workPhotoFiles.length+'/10';if(v)v.textContent=workVideoFiles.length+'/2';if(ps)ps.textContent=workPhotoFiles.length?workPhotoFiles.length+' photo captured':'No photos yet';if(vs)vs.textContent=workVideoFiles.length?workVideoFiles.length+' video captured':'No videos yet'}
function closeDhsCamera(){if(cameraRecorder&&cameraRecorder.state!=='inactive'){try{cameraRecorder.stop()}catch(e){}}cameraRecorder=null;cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;document.getElementById('dhsCamera')?.remove()}
function showProofPreview(type){
 const file=type==='photo'?workCapturePhoto:workCaptureVideo;if(!file)return;const status=document.getElementById(type==='photo'?'photoStatus':'videoStatus');const preview=document.getElementById(type==='photo'?'photoPreview':'videoPreview');if(status)status.textContent='Ready: '+file.name;if(preview){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);const url=URL.createObjectURL(file);preview.dataset.objectUrl=url;preview.src=url;preview.classList.add('show')}
}
function showCompleteFlow(id){let j=jobs.find(x=>x.id===id)||{};document.body.insertAdjacentHTML('beforeend',`<div class="complete-flow" id="completeFlow"><div class="flow-box"><div id="flowInner"><div class="flow-spinner"></div><h2>Saving Work…</h2><p>Please wait 3 seconds.</p></div></div></div>`);setTimeout(()=>{let el=document.getElementById('flowInner');if(el)el.innerHTML='<div class="flow-check">✓</div><h2>Successfully Work Completed</h2><p>Your work has been saved successfully.</p>'},3000);setTimeout(()=>{document.getElementById('completeFlow')?.remove();go('home',document.querySelector('[data-page="home"]'));document.getElementById('arrivalActions').style.display='none';document.getElementById('routePath').style.display='none';document.getElementById('mapStatus').textContent='LIVE';document.getElementById('mapLiveStatus').textContent='LIVE'},6000)}
async function saveWorkProof(id){const btn=document.getElementById('uploadCompleteBtn');try{if(!workPhotoFiles.length&&!workVideoFiles.length)throw Error('Please take at least one photo or video');if(btn){btn.disabled=true;btn.textContent='Uploading…'}let photoUrls=[],videoUrls=[];for(let i=0;i<workPhotoFiles.length;i++){if(btn)btn.textContent=`Uploading photo ${i+1}/${workPhotoFiles.length}…`;photoUrls.push(await uploadFile(workPhotoFiles[i],user.uid,'work_photo_'+id))}for(let i=0;i<workVideoFiles.length;i++){if(btn)btn.textContent=`Uploading video ${i+1}/${workVideoFiles.length}…`;videoUrls.push(await uploadFile(workVideoFiles[i],user.uid,'work_video_'+id))}let job=jobs.find(x=>x.id===id)||{},elapsed=workSeconds||0;let proofData={partnerId:user.uid,workerid:profile?.id||user.uid,partnerName:first(profile,['name'],user.email),partnerEmail:user.email,bookingId:id,customerName:first(job,['costumername','customerName'],'Customer'),phone:first(job,['costumerphone','customerPhone','phone'],''),address:first(job,['costumerAddress','customerAddress','address'],''),service:first(job,['service'],'Service'),photoUrls,videoUrls,photoUrl:photoUrls[0]||'',videoUrl:videoUrls[0]||'',photoCount:photoUrls.length,videoCount:videoUrls.length,workSeconds:elapsed,status:'COMPLETED',createdAt:firebase.firestore.FieldValue.serverTimestamp()};let ref=await db.collection('partnerWorkData').add(proofData);await db.collection('partnerJobs').doc(id).set({Stuts:'COMPLETED',partnerStatus:'COMPLETED',bookingStatus:'COMPLETED',workProofId:ref.id,workPhotos:photoUrls,workVideos:videoUrls,hasWorkPhoto:photoUrls.length>0,hasWorkVideo:videoUrls.length>0,workSeconds:elapsed,UpdatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:user.uid},{merge:true});try{await db.collection('bookings').doc(id).set({partnerStatus:'COMPLETED',bookingStatus:'COMPLETED',workProofId:ref.id,workPhotos:photoUrls,workVideos:videoUrls,workSeconds:elapsed,UpdatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})}catch(e){}await syncPartnerAdmin({lastAction:'COMPLETE_JOB',currentBookingId:id,currentBookingStatus:'COMPLETED',lastWorkProofId:ref.id,workPhotos:photoUrls,workVideos:videoUrls,workSeconds:elapsed});closeModal();showCompleteFlow(id)}catch(e){if(btn){btn.disabled=false;btn.textContent='Complete Work'}toast(e.message||'Work proof upload failed')}}
function openMapById(id){let j=jobs.find(x=>x.id===id);if(j){activeRouteJob=j;setMapJob(j);go('home',document.querySelector('[data-page="home"]'));if(['ON_THE_WAY','WORKING','ARRIVED'].includes(jobState(j)))startRouteAnimation(j)}}
function openMap(j){if(j){activeRouteJob=j;setMapJob(j)}go('home',document.querySelector('[data-page="home"]'));if(j&&['ON_THE_WAY','WORKING'].includes(jobState(j)))startRouteAnimation(j)}
function renderEarnings(){let done=jobs.filter(j=>['COMPLETED','Completed'].includes(String(first(j,['partnerStatus','Stuts','status'],''))));document.querySelector('#statJobs').textContent=done.length;document.querySelector('#statPay').textContent=money(done.reduce((s,j)=>s+Number(first(j,['amount','total','payment'],0)),0));const weekStart=new Date();weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-weekStart.getDay());const weekEarning=done.filter(j=>{const t=j.completedAt?.toDate?j.completedAt.toDate():(j.completedAt?.seconds?new Date(j.completedAt.seconds*1000):new Date(j.date||j.completedDate||0));return !isNaN(t)&&t>=weekStart}).reduce((s,j)=>s+Number(first(j,['amount','total','payment'],0)),0);document.querySelector('#statBills').textContent=money(weekEarning);document.querySelector('#statAccepted').textContent=jobs.filter(j=>String(first(j,['partnerStatus','Stuts'],'')).toUpperCase()==='ACCEPTED').length;document.querySelector('#completedList').innerHTML=done.map(j=>`<div class="card"><b>${esc(first(j,['costumername','customerName'],'Customer'))}</b><div class="muted">📍 ${esc(first(j,['costumeraddress','customerAddress','address'],'Address not available'))}</div><div class="muted">🔧 ${esc(first(j,['service'],'Service'))}</div><div class="muted">⏱️ ${esc(String(first(j,['completedTime','completedAt','date'],'Completed')))}</div><b>${money(first(j,['amount','total','payment'],0))}</b></div>`).join('')||'<div class="card empty">No completed jobs yet.</div>'}
let bills=[],billUnsub=null,itemNo=0,activePayment=null;
const DHS_UPI_ID='9718448382@axl',DHS_PAYEE='Delhi Home Service';
function listenBills(){if(billUnsub)billUnsub();let q=db.collection('bills').where('partnerId','==',user.uid);billUnsub=q.onSnapshot(s=>{bills=s.docs.map(d=>({id:d.id,...d.data()}));renderBills();renderEarnings()},e=>console.warn('bill listener',e))}
function renderBills(){const el=document.querySelector('#billList');if(!el)return;el.innerHTML=bills.map(b=>`<div class="card"><div class="row"><div class="grow"><b>${esc(first(b,['customerName','costumername'],'Customer'))}</b><div class="muted">${esc(first(b,['service'],'Service'))} • ${esc(first(b,['paymentMethod','paymentType'],'Cash'))} • ${esc(first(b,['paymentStatus','status'],'PENDING'))}</div></div><strong>${money(first(b,['total','amount'],0))}</strong></div><button class="btn white full mt8" onclick='viewBill(${JSON.stringify(b.id)})'>View / Edit Bill</button></div>`).join('')||'<div id="billListEmpty" class="card empty">No bills yet. Complete a job to create the first bill.</div>'}
function addItem(desc='',details='',qty=1,rate=0){itemNo++;const x=document.createElement('div');x.className='bill-item-row';x.innerHTML=`<div>${itemNo}</div><input class="desc" value="${esc(desc)}" placeholder="Description" oninput="calc()"><input class="details" value="${esc(details)}" placeholder="Details"><input class="qty" type="number" value="${qty}" min="1" oninput="calc()"><input class="rate" type="number" value="${rate}" min="0" oninput="calc()"><div class="bill-amount">₹0.00</div><button class="bill-del" onclick="this.parentElement.remove();renumberBillItems();calc()">×</button>`;document.getElementById('items').appendChild(x);calc()}
function renumberBillItems(){[...document.querySelectorAll('#items .bill-item-row')].forEach((x,i)=>x.children[0].textContent=i+1);itemNo=document.querySelectorAll('#items .bill-item-row').length}
function calc(){let sub=0;document.querySelectorAll('#items .bill-item-row').forEach(x=>{let q=+x.querySelector('.qty').value||0,r=+x.querySelector('.rate').value||0,a=q*r;sub+=a;x.querySelector('.bill-amount').textContent=money(a)});let d=+document.getElementById('discount').value||0,total=Math.max(0,sub-d);document.getElementById('subtotal').textContent=money(sub);document.getElementById('total').textContent=money(total);return total}
function numberWords(n){n=Math.round(n);if(!n)return'Rupees Zero';const o=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],t=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];let two=x=>x<20?o[x]:t[Math.floor(x/10)]+(x%10?' '+o[x%10]:''),three=x=>x>=100?o[Math.floor(x/100)]+' Hundred'+(x%100?' '+two(x%100):''):two(x);let s='';if(n>=10000000){s+=three(Math.floor(n/10000000))+' Crore ';n%=10000000}if(n>=100000){s+=three(Math.floor(n/100000))+' Lakh ';n%=100000}if(n>=1000){s+=three(Math.floor(n/1000))+' Thousand ';n%=1000}if(n)s+=three(n);return'Rupees '+s.trim()}
async function generate(save=true){let sub=0,items=[];document.querySelectorAll('#items .bill-item-row').forEach((x,i)=>{let q=+x.querySelector('.qty').value||0,r=+x.querySelector('.rate').value||0,a=q*r;sub+=a;items.push({description:x.querySelector('.desc').value.trim(),details:x.querySelector('.details').value.trim(),qty:q,rate:r,amount:a})});let d=+document.getElementById('discount').value||0,total=Math.max(0,sub-d);const g=id=>document.getElementById(id);g('pName').textContent=g('name').value||'—';g('pPhone').textContent=g('phone').value||'—';g('pAddress').textContent=g('address').value||'—';g('pService').textContent=g('service').value||'—';g('pInvoice').textContent=g('invoice').value||'DHS-0000';g('pDate').textContent=g('date').value||'';g('pItems').innerHTML=items.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.description)}</td><td>${esc(x.details)}</td><td>${x.qty}</td><td>${money(x.rate).replace('₹','')}</td><td>${money(x.amount).replace('₹','')}</td></tr>`).join('');g('pSubtotal').textContent=money(sub);g('pDiscount').textContent='- '+money(d);g('pTotal').textContent=money(total);g('total').textContent=money(total);g('subtotal').textContent=money(sub);g('pWords').textContent='('+numberWords(total)+' Only)';g('pStatus').textContent='Payment Status: '+g('paymentStatus').value;g('pNotes').innerHTML='';(g('notes').value||'All work has been completed successfully.').split(/\r?\n/).filter(Boolean).forEach(v=>{let li=document.createElement('li');li.textContent=v.replace(/^•\s*/,'');g('pNotes').appendChild(li)});
 if(save&&g('name').value.trim()){let inv=g('invoice').value,existing=bills.find(x=>x.invoice===inv);let data={invoice:inv,partnerId:user.uid,workerid:profile?.id||user.uid,partnerName:first(profile,['name'],user.email),partnerEmail:user.email,customerName:g('name').value,phone:g('phone').value,address:g('address').value,service:g('service').value,items,subtotal:sub,discount:d,total,date:g('date').value,notes:g('notes').value,paymentStatus:g('paymentStatus').value,paymentMethod:g('paymentMethod').value,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};try{if(existing){await db.collection('bills').doc(existing.id).set(data,{merge:true})}else{data.createdAt=firebase.firestore.FieldValue.serverTimestamp();const ref=await db.collection('bills').add(data);data.id=ref.id;bills.push({...data,createdAt:{seconds:Math.floor(Date.now()/1000)}})}await syncPartnerAdmin({lastAction:'CREATE_BILL',lastBillId:existing?.id||data.id,billInvoice:inv,billTotal:total,billPaymentStatus:g('paymentStatus').value})}catch(e){console.warn(e);toast('Bill save failed: '+e.message)}}return {invoice:g('invoice').value,customerName:g('name').value,phone:g('phone').value,address:g('address').value,service:g('service').value,amount:total,date:g('date').value,items,subtotal:sub,discount:d,notes:g('notes').value}}
function resetBill(render=true){const g=id=>document.getElementById(id);if(!g('name'))return;g('name').value=g('phone').value=g('address').value=g('service').value='';g('invoice').value='DHS-'+Date.now().toString().slice(-6);g('date').value=new Date().toISOString().slice(0,10);g('discount').value=0;g('paymentStatus').value='PENDING';g('paymentMethod').value='Cash';g('notes').value='• All work has been completed successfully.\n• Please ensure payment is made upon completion of service.\n• Thank you for choosing Delhi Home Service.';g('items').innerHTML='';itemNo=0;addItem('Service','',1,0);if(render)generate(false)}
function newBill(){go('bills',document.querySelector('[data-page="bills"]'));resetBill(true);window.scrollTo({top:0,behavior:'smooth'})}
async function viewBill(id){const b=bills.find(x=>x.id===id);if(!b)return;go('bills',document.querySelector('[data-page="bills"]'));document.getElementById('name').value=b.customerName||'';document.getElementById('phone').value=b.phone||'';document.getElementById('invoice').value=b.invoice||'';document.getElementById('date').value=b.date||'';document.getElementById('address').value=b.address||'';document.getElementById('service').value=b.service||'';document.getElementById('discount').value=b.discount||0;document.getElementById('paymentStatus').value=b.paymentStatus||'PENDING';document.getElementById('paymentMethod').value=b.paymentMethod||'Cash';document.getElementById('notes').value=b.notes||'';document.getElementById('items').innerHTML='';itemNo=0;(b.items||[]).forEach(x=>addItem(x.description||'',x.details||'',x.qty||1,x.rate||0));if(!(b.items||[]).length)addItem('Service','',1,0);await generate(false);window.scrollTo({top:0,behavior:'smooth'})}
function printBill(){generate(false);setTimeout(()=>window.print(),300)}
function downloadPDF(){printBill()}
async function payCash(){const data=await generate(true);if(!data.amount){toast('Bill total ₹0 hai');return}try{await db.collection('payments').add({billId:data.invoice,invoice:data.invoice,partnerId:user.uid,workerid:profile?.id||user.uid,customerName:data.customerName,phone:data.phone,amount:data.amount,total:data.amount,method:'Cash',mode:'Cash',paymentStatus:'SUCCESS',date:data.date,paymentDate:new Date().toISOString().slice(0,10),paymentTime:new Date().toLocaleTimeString('en-IN'),createdAt:firebase.firestore.FieldValue.serverTimestamp()});const b=bills.find(x=>x.invoice===data.invoice);if(b)await db.collection('bills').doc(b.id).set({paymentStatus:'PAID',paymentMethod:'Cash',paidAmount:data.amount,paidAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});document.getElementById('paymentStatus').value='PAID';document.getElementById('paymentMethod').value='Cash';document.getElementById('pStatus').textContent='Payment Status: PAID';await syncPartnerAdmin({lastAction:'PAYMENT_SUCCESS',paymentInvoice:data.invoice,paymentAmount:data.amount,paymentMethod:'Cash'});showPartnerSuccess('Cash Payment Successfully','Cash payment '+money(data.amount)+' recorded.')}catch(e){showPartnerSuccess('Payment Error',e.message||'Payment save failed')}}
function payQR(){generate(false).then(data=>{if(!data.amount){toast('Bill total ₹0 hai');return}activePayment=data;showModal(`<div class="modalHead"><h3>Scan & Pay</h3><button class="close" onclick="closeModal()">✕</button></div><div style="text-align:center"><div class="payment-amount">${money(data.amount)}</div><div id="partnerPaymentQr" class="qr-wrap"><div class="payment-loading">Loading QR…</div></div><div class="upi-id">UPI: ${DHS_UPI_ID}</div><div class="payment-note">PhonePe, Google Pay, Paytm ya kisi bhi UPI app se scan karein.</div><button class="pay-success-btn" onclick="markPartnerQrSuccess()">✓ Payment Successfully</button><button class="pay-cancel-btn" onclick="closeModal()">Close</button></div>`);setTimeout(()=>{const area=document.getElementById('partnerPaymentQr');if(!area||!activePayment)return;const uri='upi://pay?pa='+encodeURIComponent(DHS_UPI_ID)+'&pn='+encodeURIComponent(DHS_PAYEE)+'&am='+encodeURIComponent(data.amount.toFixed(2))+'&cu=INR&tn='+encodeURIComponent('Bill '+data.invoice);area.innerHTML='';if(window.QRCode)new QRCode(area,{text:uri,width:260,height:260,correctLevel:QRCode.CorrectLevel.M});else area.innerHTML='<div style="padding:30px;color:#c00">QR library load nahi hui.</div>'},300)})}
async function markPartnerQrSuccess(){if(!activePayment)return;const data=activePayment;try{await db.collection('payments').add({billId:data.invoice,invoice:data.invoice,partnerId:user.uid,workerid:profile?.id||user.uid,customerName:data.customerName,phone:data.phone,amount:data.amount,total:data.amount,method:'UPI QR',mode:'UPI QR',paymentStatus:'SUCCESS',date:data.date,paymentDate:new Date().toISOString().slice(0,10),paymentTime:new Date().toLocaleTimeString('en-IN'),createdAt:firebase.firestore.FieldValue.serverTimestamp()});const b=bills.find(x=>x.invoice===data.invoice);if(b)await db.collection('bills').doc(b.id).set({paymentStatus:'PAID',paymentMethod:'UPI',paidAmount:data.amount,paidAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});document.getElementById('paymentStatus').value='PAID';document.getElementById('paymentMethod').value='UPI';document.getElementById('pStatus').textContent='Payment Status: PAID';await syncPartnerAdmin({lastAction:'PAYMENT_SUCCESS',paymentInvoice:data.invoice,paymentAmount:data.amount,paymentMethod:'UPI QR'});closeModal();showPartnerSuccess('Payment Successfully','UPI payment '+money(data.amount)+' recorded.')}catch(e){toast('Payment save failed: '+e.message)}}
function showPartnerSuccess(title,text){document.getElementById('partnerSuccess')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="complete-flow" id="partnerSuccess"><div class="flow-box"><div class="flow-check">✓</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div></div>`);setTimeout(()=>document.getElementById('partnerSuccess')?.remove(),3000)}
function editProfile(){showModal(`<div class="modalHead"><h3>Edit Profile</h3><button class="close" onclick="closeModal()">✕</button></div><label>Name</label><input id="en" value="${esc(first(profile,['name'],''))}"><label>Skill</label><input id="es" value="${esc(first(profile,['skill','service'],''))}"><label>Selfie</label><input id="ep" type="file" accept="image/*"><button class="btn primary full mt8" onclick="saveProfile()">Save Profile</button>`)}
async function saveProfile(){try{let patch={name:en.value,skill:es.value,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),profileUpdatedBy:'partner'};if(ep.files[0])patch.selfie=await uploadFile(ep.files[0],user.uid,'profile');let c=profile?.collection||'workers',id=profile?.id||user.uid;await db.collection(c).doc(id).set(patch,{merge:true});Object.assign(profile,patch);await syncPartnerAdmin({lastAction:'UPDATE_PROFILE'});closeModal();renderProfile();toast('Profile updated and Admin synced')}catch(e){toast(e.message)}}
async function publishPartnerLocation(pos,forceOnline=null){let c=profile?.collection||'workers',id=profile?.id||user.uid;try{const now=firebase.firestore.FieldValue.serverTimestamp();const isOn=forceOnline===null?(online||profile?.online===true):forceOnline;const active=jobs.find(x=>['ACCEPTED','ON_THE_WAY','WORKING','ARRIVED'].includes(jobState(x)));const patch={latitude:pos.coords.latitude,longitude:pos.coords.longitude,lat:pos.coords.latitude,lng:pos.coords.longitude,locationUpdatedAt:now,locationPermission:'granted'};await db.collection(c).doc(id).set({...patch,lastSeen:now},{merge:true});await db.collection('partnerLocations').doc(user.uid).set({partnerId:user.uid,workerid:profile?.id||user.uid,partnerName:first(profile,['name'],user.email),partnerEmail:user.email,email:user.email,online:isOn,availability:isOn?'online':'offline',status:isOn?'online':'offline',partnerStatus:isOn?'online':'offline',currentJobId:active?.id||'',currentJobStatus:active?jobState(active):'IDLE',lastSeen:now,locationUpdatedAt:now,locationPermission:'granted',...patch},{merge:true});}catch(e){console.warn('location sync',e)}}
async function toggleOnline(){try{let next=online?'offline':'online';let c=profile?.collection||'workers',id=profile?.id||user.uid;const now=firebase.firestore.FieldValue.serverTimestamp();await db.collection(c).doc(id).set({status:next,online:next==='online',availability:next,lastSeen:now,uid:user.uid,email:user.email,workeremail:user.email,partnerStatus:next,locationSharing:next==='online'},{merge:true});online=next==='online';profile.status=next;profile.online=online;if(!online){document.getElementById('np')?.remove();document.getElementById('partnerBookingRequest')?.style.setProperty('display','none');document.querySelector('#homeMap .partnerMapOverlay')?.classList.remove('requestActive');}let publish=async pos=>publishPartnerLocation(pos,online);if(navigator.geolocation){navigator.geolocation.getCurrentPosition(publish,()=>{db.collection('partnerLocations').doc(user.uid).set({partnerId:user.uid,workerid:profile?.id||user.uid,partnerName:first(profile,['name'],user.email),email:user.email,online,availability:online?'online':'offline',status:online?'online':'offline',partnerStatus:online?'online':'offline',lastSeen:now,locationUpdatedAt:now},{merge:true})},{enableHighAccuracy:true,timeout:10000,maximumAge:5000})}else{await db.collection('partnerLocations').doc(user.uid).set({partnerId:user.uid,workerid:profile?.id||user.uid,partnerName:first(profile,['name'],user.email),email:user.email,online,availability:online?'online':'offline',status:online?'online':'offline',partnerStatus:online?'online':'offline',lastSeen:now},{merge:true})}await syncPartnerAdmin({lastAction:online?'GO_ONLINE':'GO_OFFLINE',partnerStatus:next,online});renderProfile();toast('You are '+next+' • Admin updated')}catch(e){toast(e.message)}}
function getLocation(){if(!navigator.geolocation)return;navigator.geolocation.watchPosition(pos=>publishPartnerLocation(pos,null),()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:15000})}
async function enableFCM(){if(!('Notification'in window)||!('serviceWorker'in navigator)||!firebase.messaging.isSupported())return;try{let perm=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(perm!=='granted')return;let reg=await navigator.serviceWorker.register('firebase-messaging-sw.js');let m=firebase.messaging();fcmToken=await m.getToken({serviceWorkerRegistration:reg});if(fcmToken){let c=profile?.collection||'workers',id=profile?.id||user.uid;await db.collection(c).doc(id).set({fcmToken:fcmToken,fcmUpdatedAt:firebase.firestore.FieldValue.serverTimestamp(),uid:user.uid,email:user.email,workeremail:user.email},{merge:true})}m.onMessage(payload=>incomingNotification(payload.data||payload.notification||{}))}catch(e){console.warn(e)}}
async function incomingNotification(d){
 if(!online)return;
 playAlert();
 let bid=first(d,['bookingId','bookingid','bookingID','id'],'');
 if(bid){
   try{const snap=await db.collection('partnerJobs').doc(String(bid)).get();if(snap.exists){const j={id:snap.id,...snap.data()};if(!jobs.some(x=>x.id===j.id))jobs.unshift(j);renderJobs();showNewBookingPopup(j);return}}catch(e){console.warn('notification booking fetch',e)}
 }
 let customer=first(d,['customerName','costumername'],'Customer'),service=first(d,['service','serviceType'],'Service');
 document.getElementById('np')?.remove();
 document.body.insertAdjacentHTML('beforeend',`<div class="notificationPop workGlass" id="np"><h3>🔔 New DHS Booking</h3><p>Customer: <b>${esc(customer)}</b><br>Service: <b>${esc(service)}</b></p><div class="actions"><button class="btn white" onclick="document.getElementById('np')?.remove()">Open</button></div></div>`);
}
function openNotifications(){showModal(`<div class="modalHead"><h3>Notifications</h3><button class="close" onclick="closeModal()">✕</button></div><p class="muted">New DHS booking notifications are delivered here and through Firebase Cloud Messaging when configured.</p>`)}
function showModal(inner){closeModal();document.body.insertAdjacentHTML('beforeend',`<div class="modalBack" id="modal"><div class="modal">${inner}</div></div>`)}function closeModal(){document.getElementById('modal')?.remove()}
async function resetData(){let p=prompt('Enter your password to confirm reset');if(!p)return;try{await auth.signInWithEmailAndPassword(user.email,p);let batch=db.batch();let qs=await db.collection('partnerJobs').where('workeruid','==',user.uid).get();qs.docs.forEach(d=>batch.delete(d.ref));let bs=await db.collection('bills').where('partnerId','==',user.uid).get();bs.docs.forEach(d=>batch.delete(d.ref));let ps=await db.collection('payments').where('partnerId','==',user.uid).get();ps.docs.forEach(d=>batch.delete(d.ref));await batch.commit();await syncPartnerAdmin({status:'offline',online:false,availability:'offline',lastAction:'RESET_DATA',resetAt:firebase.firestore.FieldValue.serverTimestamp()});online=false;profile.status='offline';profile.online=false;renderProfile();toast('Partner data reset and Admin updated')}catch(e){toast('Reset failed: '+e.message)}}
function toast(t){let e=document.getElementById('toast');if(!e){e=document.createElement('div');e.id='toast';e.style.cssText='position:fixed;z-index:150;bottom:92px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:11px 14px;border-radius:12px;font-size:10px';document.body.appendChild(e)}e.textContent=t;e.style.display='block';clearTimeout(window._toast);window._toast=setTimeout(()=>e.style.display='none',2600)}
async function processPushAction(){
 try{
  const q=new URLSearchParams(location.search);const id=q.get('bookingId');const action=q.get('action');
  if(!id||!action||!user)return;
  history.replaceState({},document.title,location.pathname);
  if(action==='accept'||action==='reject'){await jobDecision(id,action==='accept'?'ACCEPTED':'REJECTED');}
 }catch(e){console.warn('push action',e)}
}
async function gate(u){
 if(!u){profile=null;login();return}
 try{
  profile=null;
  // Admin app creates/approves partners in workers (and mirrors to partners).
  // Match the Firebase Auth account to the admin worker by UID, workeremail, or email.
  let w=await db.collection('workers').doc(u.uid).get();
  if(w.exists){ profile={id:w.id,collection:'workers',...w.data()}; }
  else {
   let snap=await db.collection('workers').where('workeremail','==',u.email).limit(1).get();
   if(snap.empty) snap=await db.collection('workers').where('email','==',u.email).limit(1).get();
   if(!snap.empty){const d=snap.docs[0]; profile={id:d.id,collection:'workers',...d.data()};}
  }
  if(!profile){
   let snap=await db.collection('partners').where('email','==',u.email).limit(1).get();
   if(!snap.empty){const d=snap.docs[0]; profile={id:d.id,collection:'partners',...d.data()};}
  }
  if(!profile){
   const reg=await db.collection('partnerRegistrations').doc(u.uid).get();
   if(reg.exists){
     const d=reg.data(),st=String(d.status||d.partnerStatus||d.registrationStatus||'').toUpperCase();
     if(d.approved===true||['APPROVED','JOINED','ACTIVE'].includes(st)){profile={id:u.uid,collection:'partnerRegistrations',...d};}
     else if(st==='PENDING_REVIEW'){showWaiting(u.email,u.uid);return;}
     else if(st==='REJECTED'){showWaiting(u.email,u.uid);return;}
   }
  }
  if(!profile){
   try{
     const app=await db.collection('partnerApplications').doc(u.uid).get();
     if(app.exists){
       const d=app.data(),st=String(d.status||d.partnerStatus||d.registrationStatus||'').toUpperCase();
       if(d.approved===true||['APPROVED','JOINED','ACTIVE'].includes(st)){profile={id:u.uid,collection:'partnerApplications',...d};}
       else if(st==='PENDING_REVIEW'){showWaiting(u.email,u.uid);return;}
     }
   }catch(e){console.warn('partnerApplications lookup skipped:',e)}
  }
  // If the Admin-created worker is found, allow login unless explicitly disabled/rejected.
  if(profile){
    const st=String(profile.status||'').toUpperCase();
    if(profile.approved===false || st==='REJECTED' || st==='DISABLED'){
      await auth.signOut();
      document.getElementById('root').innerHTML='<div class="wait"><div class="waitbox glass"><div class="big">❌</div><h2>Partner Access Blocked</h2><p>Admin has not approved or has disabled this partner account.</p><button class="btn white full" onclick="login()">Back to Login</button></div></div>';
      return;
    }
    shell();
    return;
  }
  // New self-registration path: only pending/rejected registrations reach waiting page.
  const reg=await db.collection('partnerRegistrations').doc(u.uid).get();
  if(reg.exists){
    const d=reg.data(),st=String(d.status||'').toUpperCase();
    if(st==='PENDING_REVIEW'){showWaiting(u.email,u.uid);return;}
    if(st==='REJECTED'){showWaiting(u.email,u.uid);return;}
    if(st==='APPROVED'||st==='JOINED'||st==='ACTIVE'){profile={id:u.uid,collection:'partnerRegistrations',...d};shell();return;}
  }
  await auth.signOut();
  document.getElementById('root').innerHTML='<div class="wait"><div class="waitbox glass"><div class="big">⚠️</div><h2>Partner Profile Not Found</h2><p>This Firebase account is not linked to a DHS Admin worker profile yet.</p><button class="btn white full" onclick="login()">Back to Login</button></div></div>';
 }catch(e){
   console.warn('DHS Partner profile read blocked:', e);
   document.getElementById('root').innerHTML='<div class="wait"><div class="waitbox glass"><div class="big">⚠️</div><h2>Unable to load DHS Partner profile</h2><p>Firebase permission or profile setup needs to be checked by DHS Admin.</p><button class="btn white full" onclick="auth.signOut()">Back to Login</button></div></div>';
 }
}
auth.onAuthStateChanged(async u=>{
  document.getElementById('signinPop')?.remove();
  user=u;
  if(u){gate(u);} else {login();}
});
