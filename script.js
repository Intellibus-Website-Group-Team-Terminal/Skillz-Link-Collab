console.log('Hello!');
/* =============== Firebase CONFIG (replace) =============== */
const firebaseConfig = {
  apiKey: 'AIzaSyCZ8ZPfEMRIk3QPFEFrpuakvWBiW9dKN4A',
  authDomain: 'skillzlink.firebaseapp.com',
  databaseURL: 'https://skillzlink-default-rtdb.firebaseio.com',
  projectId: 'skillzlink',
  storageBucket: 'skillzlink.firebasestorage.app',
  messagingSenderId: '219471892033',
  appId: '1:219471892033:web:79eba4e2f87b04c73d00c0',
};


firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();


/* ========================= Utilities ========================= */
const byId = (id) => document.getElementById(id);
const skillsToArray = (s) =>
  (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const toast = (msg) => {
  const box = byId('notifyArea');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};
const todayISO = () => new Date().toISOString().slice(0, 10);


/* ========================= Role Toggle (no auth) ========================= */
let CURRENT_ROLE = 'employee';
let EMPLOYER_DEMO_NAME = '';
function route() {
  byId('employeePortal').classList.toggle(
    'hidden',
    CURRENT_ROLE !== 'employee'
  );
  byId('employerPortal').classList.toggle(
    'hidden',
    CURRENT_ROLE !== 'employer'
  );
  byId('tabEmployee').classList.toggle('active', CURRENT_ROLE === 'employee');
  byId('tabEmployer').classList.toggle('active', CURRENT_ROLE === 'employer');
  byId('whoami').textContent = `Demo: Viewing ${CURRENT_ROLE} page`;
  purgeExpiredAutoPrograms();
  // refresh dropdown data when switching
  refreshOfferedSkills(); // updates employee desired skills + employer program skills
}
byId('tabEmployee').addEventListener('click', () => {
  CURRENT_ROLE = 'employee';
  route();
});
byId('tabEmployer').addEventListener('click', () => {
  CURRENT_ROLE = 'employer';
  route();
});
route();


/* ========================= Custom Multi-Select Dropdown =========================
   API:
     initMultiDD('desiredSkillsDD', { options: ['coding','design'], selected: ['coding'] })
     getMultiDD('desiredSkillsDD') -> ['coding', ...]
     setOptionsMultiDD('desiredSkillsDD', ['a','b'], selectedArray?)
=============================================================================== */
function initMultiDD(id, { options = [], selected = [] } = {}) {
  const root = byId(id);
  const btn = root.querySelector('.dd-btn');
  const panel = root.querySelector('.dd-panel');


  function render() {
    if (!options.length) {
      panel.innerHTML = `<div class="dd-empty">No options available.</div>`;
    } else {
      panel.innerHTML = options
        .map((opt) => {
          const checked = selected.includes(opt);
          return `<div class="dd-item" data-value="${opt}">
          <input type="checkbox" ${checked ? 'checked' : ''} />
          <span>${opt}</span>
        </div>`;
        })
        .join('');
    }
    btn.textContent = selected.length
      ? `${selected.length} selected`
      : 'Select…';
  }


  // open/close
  btn.onclick = () => {
    root.classList.toggle('open');
  };
  // outside click
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) root.classList.remove('open');
  });
  // toggle item
  panel.addEventListener('click', (e) => {
    const item = e.target.closest('.dd-item');
    if (!item) return;
    const val = item.dataset.value;
    if (selected.includes(val)) {
      selected = selected.filter((v) => v !== val);
    } else {
      selected.push(val);
    }
    render();
  });


  // attach helpers
  root._get = () => [...selected];
  root._setOptions = (opts, sel = []) => {
    options = [...new Set(opts)];
    selected = sel.filter((v) => options.includes(v));
    render();
  };
  root._setSelected = (sel = []) => {
    selected = sel.filter((v) => options.includes(v));
    render();
  };


  render();
}
function getMultiDD(id) {
  return byId(id)._get ? byId(id)._get() : [];
}
function setOptionsMultiDD(id, opts, sel) {
  if (byId(id)._setOptions) byId(id)._setOptions(opts, sel || []);
}
function setSelectedMultiDD(id, sel) {
  if (byId(id)._setSelected) byId(id)._setSelected(sel || []);
}


/* ========================= Offered Skills Catalog =========================
   Built from programs.skill_required (comma separated).
   Used for:
     - Employee Desired Skills dropdown (ONLY offered skills)
     - Employer Program Skills dropdown (for convenience; plus "Add new skill")
============================================================================ */
async function refreshOfferedSkills() {
  const snap = await db
    .collection('programs')
    .where('status', '==', 'approved')
    .get();
  const set = new Set();
  snap.forEach((d) => {
    const p = d.data();
    skillsToArray(p.skill_required).forEach((s) => set.add(s.toLowerCase()));
  });
  const skills = [...set].sort();


  // Update employee desired skills dropdown
  setOptionsMultiDD('desiredSkillsDD', skills);


  // Update employer program skills dropdown (they can also add new ones)
  setOptionsMultiDD('programSkillsDD', skills);
}


/* =========================================================
   =============== EMPLOYEE FEATURES
========================================================= */


async function createOrUpdateProfile(formData) {
  const {
    name,
    contact,
    age,
    skillsHaveCSV,
    desiredSkills,
    programType,
    rolePref,
    experience,
    education,
    location,
    resume,
  } = formData;
  if (!name || !contact) return alert('Please fill out name and contact.');
  if (!age || age < 15 || age > 29)
    return alert('You must be between 15 and 29 to participate.');


  // Upload resume if provided
  let resumeURL = '';
  if (resume && resume.size > 0) {
    const safeName = name.replace(/[^\w.-]/g, '_');
    const ref = storage.ref(`resumes/${safeName}_${Date.now()}_${resume.name}`);
    await ref.put(resume);
    resumeURL = await ref.getDownloadURL();
  }


  await db
    .collection('users')
    .doc(name)
    .set(
      {
        role: 'employee',
        name: name.trim(),
        contact: contact.trim(),
        age: Number(age),
        skills: skillsToArray(skillsHaveCSV),
        desiredSkills, // array from dropdown
        rolePref, // single-select: 'full-time'|'part-time'|'remote'
        programTypePref: programType || '',
        experience: (experience || '').trim(),
        education: (education || '').trim(),
        location: (location || '').trim(),
        resumeURL,
        updatedAt: new Date(),
      },
      { merge: true }
    );


  toast('Profile saved.');
  showDashboard(name);
}


async function loadProfile() {
  const name = byId('profileForm').name.value.trim();
  if (!name) return alert('Enter your name first.');
  const doc = await db.collection('users').doc(name).get();
  if (!doc.exists) return alert('No profile found.');


  const u = doc.data();
  const f = byId('profileForm');
  f.name.value = u.name || '';
  f.contact.value = u.contact || '';
  f.age.value = u.age || '';
  f.skills.value = (u.skills || []).join(', ');
  f.location.value = u.location || '';
  f.experience.value = u.experience || '';
  f.education.value = u.education || '';
  f.programType.value = u.programTypePref || '';
  f.rolePref.value = u.rolePref || 'full-time';


  // ensure offered skills loaded, then preselect
  await refreshOfferedSkills();
  setSelectedMultiDD('desiredSkillsDD', u.desiredSkills || []);


  toast('Profile loaded');
  showDashboard(u.name);
}


// Search approved programs
async function viewAvailablePrograms(filters) {
  const container = byId('programList');
  container.innerHTML = "<p class='muted'>Loading programs…</p>";
  await purgeExpiredAutoPrograms();
  const snap = await db
    .collection('programs')
    .where('status', '==', 'approved')
    .get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));


  if (filters.skill) {
    const s = filters.skill.toLowerCase();
    items = items.filter((p) =>
      (p.skill_required || '').toLowerCase().includes(s)
    );
  }
  if (filters.location) {
    const loc = filters.location.toLowerCase();
    items = items.filter((p) => (p.location || '').toLowerCase().includes(loc));
  }


  displayPrograms(items.slice(0, 5));
}


function displayPrograms(list) {
  const container = byId('programList');
  container.innerHTML = '';
  if (!list.length)
    return (container.innerHTML = '<p>No matching programs found.</p>');
  list.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'program-card';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3>${p.title}</h3>
        <span class="pill status-${p.status}">${p.status}</span>
      </div>
      <p><b>Company:</b> ${p.company || '—'}</p>
      <p><b>Type:</b> ${p.programType || '—'} | <b>Role:</b> ${
      p.roleOffered || '—'
    }</p>
      <p><b>Location:</b> ${p.location || '—'} | <b>Duration:</b> ${
      p.duration || '—'
    }</p>
      <p><b>Skills:</b> ${p.skill_required || '—'}</p>
      <p><b>Enrollment:</b> ${p.enrollmentMode || 'manual'} | <b>Limit:</b> ${
      p.applicantLimit ?? '—'
    } | <b>Accepted:</b> ${p.acceptedCount ?? 0}</p>
      <p class="muted">${p.description || ''}</p>
      <button onclick="applyToProgram('${p.id}')">Apply</button>
    `;
    container.appendChild(el);
  });
}


// Apply (age, auto/manual, limit)
async function applyToProgram(programId) {
  const f = byId('profileForm');
  const name = f.name.value.trim();
  if (!name) return alert('Enter your name on the profile form first.');
  const userDoc = await db.collection('users').doc(name).get();
  if (!userDoc.exists) return alert('Save your profile first.');
  const user = userDoc.data();
  if (!user.age || user.age < 15 || user.age > 29)
    return alert('You must be 15–29 to apply.');


  const pRef = db.collection('programs').doc(programId);
  const pSnap = await pRef.get();
  if (!pSnap.exists) return alert('Program not found.');
  const p = pSnap.data();
  if (p.status !== 'approved') return alert('Program not available.');


  if (p.enrollmentMode === 'automatic') {
    const limit = Number(p.applicantLimit ?? 0);
    const accepted = Number(p.acceptedCount ?? 0);
    if (limit && accepted >= limit) {
      await addNotification(
        name,
        'application',
        `Program "${p.title}" is full.`
      );
      toast('Program is full.');
      return;
    }
    await db.collection('enrollments').add({
      userName: name,
      program_id: programId,
      confirmed: true,
      timestamp: new Date(),
    });
    await pRef.set({ acceptedCount: accepted + 1 }, { merge: true });
    await addNotification(
      name,
      'enrollment',
      `You have been accepted to "${p.title}".`
    );
    toast('Enrolled!');
  } else {
    await db.collection('enrollments').add({
      userName: name,
      program_id: programId,
      confirmed: false,
      timestamp: new Date(),
    });
    await addNotification(
      name,
      'pending',
      `Your application to "${p.title}" is pending employer approval. Interview may be required.`
    );
    toast('Applied — pending approval/interview.');
  }


  showDashboard(name);
}


// Dashboard + recommendations (role is single-select now)
async function showDashboard(userName) {
  const dash = byId('dashboard');
  dash.innerHTML = "<p class='muted'>Loading dashboard…</p>";
  const uDoc = await db.collection('users').doc(userName).get();
  if (!uDoc.exists) return (dash.innerHTML = '<p>No profile found.</p>');
  const u = uDoc.data();


  const enrSnap = await db
    .collection('enrollments')
    .where('userName', '==', userName)
    .get();
  const programIds = enrSnap.docs.map((d) => d.data().program_id);
  const enrolledTitles = [];
  for (const pid of programIds) {
    const p = await db.collection('programs').doc(pid).get();
    if (p.exists) enrolledTitles.push(p.data().title);
  }


  const notifSnap = await db
    .collection('notifications')
    .where('user', '==', userName)
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get();
  const notifs = notifSnap.docs.map((d) => d.data());


  dash.innerHTML = `
    <div class="row">
      <div>
        <h3>${u.name}</h3>
        <p><b>Contact:</b> ${u.contact}</p>
        <p><b>Age:</b> ${u.age ?? '—'} | <b>Location:</b> ${
    u.location || '—'
  }</p>
      </div>
      <div>
        <p><b>Skills:</b> ${u.skills?.join(', ') || '—'}</p>
        <p><b>Wants to learn:</b> ${
          (u.desiredSkills || []).join(', ') || '—'
        }</p>
        <p><b>Program Type Pref:</b> ${u.programTypePref || 'Any'}</p>
        <p><b>Role Pref:</b> ${u.rolePref || '—'}</p>
      </div>
    </div>


    <h3 style="margin-top:10px;">Current Applications / Enrollments</h3>
    <ul class="list">
      ${
        enrolledTitles.map((t) => `<li>${t}</li>`).join('') ||
        '<li>None yet</li>'
      }
    </ul>


    <h3 style="margin-top:10px;">Notifications</h3>
    <ul class="list">
      ${
        notifs.map((n) => `<li><b>${n.type}:</b> ${n.message}</li>`).join('') ||
        '<li>None</li>'
      }
    </ul>


    <div id="recoSection" class="card" style="margin-top:14px;">
      <h3>Recommended For You</h3>
      <div id="recoList"><p class="muted">Computing recommendations…</p></div>
    </div>
  `;
  generateRecommendations(u);
}


// Recommendation with single role match
async function generateRecommendations(user) {
  const have = (user.skills || []).map((s) => s.toLowerCase());
  const want = (user.desiredSkills || []).map((s) => s.toLowerCase());
  const userLoc = (user.location || '').toLowerCase();
  const typePref = (user.programTypePref || '').toLowerCase();
  const rolePref = (user.rolePref || '').toLowerCase();


  await purgeExpiredAutoPrograms();
  const snap = await db
    .collection('programs')
    .where('status', '==', 'approved')
    .get();
  const programs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));


  const scored = programs
    .map((p) => {
      const req = skillsToArray(p.skill_required).map((s) => s.toLowerCase());
      const haveOverlap = req.filter((s) => have.includes(s)).length;
      const wantOverlap = req.filter((s) => want.includes(s)).length;
      const haveScore = req.length ? haveOverlap / req.length : 0;
      const wantScore = req.length ? wantOverlap / req.length : 0;
      const locBonus =
        userLoc && (p.location || '').toLowerCase() === userLoc ? 1 : 0;
      const typeBonus =
        typePref && (p.programType || '').toLowerCase() === typePref ? 1 : 0;
      const roleBonus =
        rolePref && (p.roleOffered || '').toLowerCase() === rolePref ? 1 : 0;


      const total =
        haveScore * 0.42 +
        wantScore * 0.23 +
        locBonus * 0.12 +
        typeBonus * 0.12 +
        roleBonus * 0.11;
      return {
        id: p.id,
        title: p.title,
        location: p.location,
        skill_required: p.skill_required,
        programType: p.programType,
        roleOffered: p.roleOffered,
        score: total,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);


  const target = byId('recoList');
  target.innerHTML = '';
  scored.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'program-card';
    el.innerHTML = `
      <h4>${i + 1}. ${p.title}</h4>
      <p><b>Type:</b> ${p.programType || '—'} | <b>Role:</b> ${
      p.roleOffered || '—'
    }</p>
      <p><b>Location:</b> ${p.location || '—'}</p>
      <p><b>Skills:</b> ${p.skill_required || '—'}</p>
      <p class="muted">Match Score: ${(p.score * 100).toFixed(1)}%</p>
      <button onclick="applyToProgram('${p.id}')">Apply</button>
    `;
    target.appendChild(el);
  });
}


/* =========================================================
   =============== EMPLOYER FEATURES
========================================================= */


byId('addSkillBtn').addEventListener('click', () => {
  const v = (byId('newSkillInput').value || '').trim().toLowerCase();
  if (!v) return;
  const current = getMultiDD('programSkillsDD');
  const opts = new Set([...getMultiDD('programSkillsDD'), ...current, v]);
  setOptionsMultiDD('programSkillsDD', [...opts].sort(), [...current, v]);
  byId('newSkillInput').value = '';
});


async function createProgram(form) {
  const ownerName = byId('employerName').value.trim();
  if (!ownerName)
    return alert('Enter Employer Name above so we can link ownership.');


  const title = form.title.value.trim();
  const company = form.company.value.trim();
  const description = form.description.value.trim();
  const requirements = form.requirements.value.trim();
  const duration = form.duration.value.trim();
  const location = form.location.value.trim();


  const programType = form.programTypeOffer.value; // single-select
  const roleOffered = form.roleOffered.value; // single-select
  const selectedSkills = getMultiDD('programSkillsDD'); // array
  const applicantLimit = Number(form.applicantLimit.value || 0);
  const enrollmentMode = form.enrollmentMode.value;
  const responseDeadline = form.responseDeadline.value;


  if (!title || !company) return alert('Title and company are required.');
  if (!selectedSkills.length) return alert('Select at least one skill.');
  if (enrollmentMode === 'automatic') {
    if (!responseDeadline)
      return alert('Automatic mode requires a response deadline (≤ 30 days).');
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    const deadlineDate = new Date(responseDeadline + 'T00:00:00');
    if (deadlineDate > maxDate)
      return alert('Deadline must be within 30 days.');
  }


  // curriculum upload (optional)
  let curriculumURL = '';
  const file = form.curriculum.files[0];
  if (file) {
    const ref = storage.ref(
      `curricula/${ownerName}_${Date.now()}_${file.name}`
    );
    await ref.put(file);
    curriculumURL = await ref.getDownloadURL();
  }


  await db.collection('programs').add({
    title,
    company,
    description,
    requirements,
    skill_required: selectedSkills.join(', '),
    duration,
    location,
    curriculumURL,
    programType,
    roleOffered,
    applicantLimit: applicantLimit || 0,
    acceptedCount: 0,
    enrollmentMode,
    responseDeadline: responseDeadline || '',
    ownerName,
    status: 'approved',
    createdAt: new Date(),
  });


  toast('Program created.');
  form.reset();


  // Refresh offered skills so employees see the new ones
  await refreshOfferedSkills();


  loadMyPrograms();
}


async function loadMyPrograms() {
  EMPLOYER_DEMO_NAME = byId('employerName').value.trim();
  const box = byId('myPrograms');
  if (!EMPLOYER_DEMO_NAME) {
    box.innerHTML = "<p class='muted'>Enter your Employer Name above.</p>";
    return;
  }


  await purgeExpiredAutoPrograms();
  const snap = await db
    .collection('programs')
    .where('ownerName', '==', EMPLOYER_DEMO_NAME)
    .get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!items.length) {
    box.innerHTML = '<p>No programs yet.</p>';
    return;
  }
  box.innerHTML = '';
  items.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'program-card';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3>${p.title}</h3>
        <span class="pill status-${p.status}">${p.status}</span>
      </div>
      <p><b>Company:</b> ${p.company}</p>
      <p><b>Type:</b> ${p.programType || '—'} | <b>Role:</b> ${
      p.roleOffered || '—'
    }</p>
      <p><b>Location:</b> ${p.location || '—'} | <b>Duration:</b> ${
      p.duration || '—'
    }</p>
      <p><b>Skills:</b> ${p.skill_required || '—'}</p>
      <p><b>Enrollment:</b> ${p.enrollmentMode || 'manual'} | <b>Limit:</b> ${
      p.applicantLimit ?? '—'
    } | <b>Accepted:</b> ${p.acceptedCount ?? 0}</p>
      <p><b>Response Deadline:</b> ${p.responseDeadline || '—'}</p>
      <div class="row">
        <button class="ghost" onclick="editProgramPrompt('${
          p.id
        }')">Edit</button>
        <button class="danger" onclick="deleteProgram('${
          p.id
        }')">Delete</button>
      </div>
      <p class="muted">Program ID: ${p.id}</p>
    `;
    box.appendChild(el);
  });
}


async function editProgramPrompt(id) {
  const doc = await db.collection('programs').doc(id).get();
  if (!doc.exists) return;
  const p = doc.data();
  const newTitle = prompt('Edit title:', p.title);
  if (newTitle === null) return;
  await db
    .collection('programs')
    .doc(id)
    .set({ title: newTitle }, { merge: true });
  toast('Program updated.');
  loadMyPrograms();
}


async function deleteProgram(id) {
  if (!confirm('Delete this program?')) return;
  await db.collection('programs').doc(id).delete();
  toast('Program deleted.');
  loadMyPrograms();
}


async function loadParticipants(programId) {
  const target = byId('participants');
  target.innerHTML = "<p class='muted'>Loading…</p>";
  const enr = await db
    .collection('enrollments')
    .where('program_id', '==', programId)
    .get();
  if (enr.empty) {
    target.innerHTML = '<p>No enrollments.</p>';
    return;
  }


  const rows = [];
  for (const d of enr.docs) {
    const e = d.data();
    const uDoc = await db.collection('users').doc(e.userName).get();
    const u = uDoc.exists
      ? uDoc.data()
      : { name: e.userName || 'Unknown', contact: '' };
    rows.push({
      name: u.name || 'Unknown',
      contact: u.contact || '',
      when: e.timestamp?.toDate?.().toLocaleString?.() || '',
      confirmed: e.confirmed,
    });
  }


  target.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Contact</th><th>Enrolled</th><th>Status</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr><td>${r.name}</td><td>${r.contact}</td><td>${
                r.when
              }</td><td>${
                r.confirmed ? 'Accepted' : 'Pending/Denied'
              }</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}


async function loadProgramStats() {
  const box = byId('stats');
  const owner = byId('employerName').value.trim();
  if (!owner)
    return (box.innerHTML = "<p class='muted'>Enter Employer Name above.</p>");
  await purgeExpiredAutoPrograms();
  const myPrograms = await db
    .collection('programs')
    .where('ownerName', '==', owner)
    .get();
  if (myPrograms.empty) return (box.innerHTML = '<p>No programs yet.</p>');
  const items = myPrograms.docs.map((d) => ({ id: d.id, ...d.data() }));
  const counts = [];
  for (const p of items) {
    const apps = await db
      .collection('enrollments')
      .where('program_id', '==', p.id)
      .get();
    const confirmed = apps.docs.filter((x) => x.data().confirmed).length;
    counts.push({
      title: p.title,
      applicants: apps.size,
      confirmed,
      completion: 0,
    });
  }
  box.innerHTML = `
    <table>
      <thead><tr><th>Program</th><th>Applicants</th><th>Confirmed</th><th>Completion</th></tr></thead>
      <tbody>
        ${counts
          .map(
            (c) =>
              `<tr><td>${c.title}</td><td>${c.applicants}</td><td>${c.confirmed}</td><td>${c.completion}%</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}


/* ========================= Notifications & Purge ========================= */
async function addNotification(userName, type, message) {
  await db
    .collection('notifications')
    .add({ user: userName, type, message, timestamp: new Date() });
}
async function purgeExpiredAutoPrograms() {
  const today = new Date(todayISO() + 'T00:00:00');
  const snap = await db
    .collection('programs')
    .where('enrollmentMode', '==', 'automatic')
    .get();
  const toRemove = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(
      (p) =>
        p.status !== 'removed' &&
        p.responseDeadline &&
        new Date(p.responseDeadline + 'T00:00:00') < today
    );


  for (const p of toRemove) {
    const apps = await db
      .collection('enrollments')
      .where('program_id', '==', p.id)
      .get();
    for (const a of apps.docs) {
      const app = a.data();
      if (app.confirmed) await a.ref.set({ confirmed: false }, { merge: true });
      if (app.userName)
        await addNotification(
          app.userName,
          'denied',
          `Application to "${p.title}" was denied due to missed response deadline.`
        );
    }
    await db
      .collection('programs')
      .doc(p.id)
      .set({ status: 'removed' }, { merge: true });
  }
}


/* ========================= Wire up UI ========================= */
// init dropdown widgets
initMultiDD('desiredSkillsDD', { options: [], selected: [] });
initMultiDD('programSkillsDD', { options: [], selected: [] });
refreshOfferedSkills();


// Employee
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  await createOrUpdateProfile({
    name: f.name.value.trim(),
    contact: f.contact.value.trim(),
    age: Number(f.age.value),
    skillsHaveCSV: f.skills.value,
    desiredSkills: getMultiDD('desiredSkillsDD'),
    programType: f.programType.value,
    rolePref: f.rolePref.value,
    location: f.location.value,
    experience: f.experience.value,
    education: f.education.value,
    resume: f.resume.files[0],
  });
});
document
  .getElementById('loadProfileBtn')
  .addEventListener('click', () => loadProfile());
byId('searchBtn').addEventListener('click', () => {
  viewAvailablePrograms({
    skill: byId('skillFilter').value.trim(),
    location: byId('locationFilter').value.trim(),
  });
});


// Employer
byId('loadMyProgramsBtn').addEventListener('click', () => {
  loadMyPrograms();
  loadProgramStats();
});
byId('programForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await createProgram(e.target);
});
byId('loadParticipantsBtn').addEventListener('click', () => {
  const id = byId('participantsProgramId').value.trim();
  if (!id) return alert('Enter a Program ID.');
  loadParticipants(id);
});


/* ============ Optional: seed demo ============ */
async function seedProgramsOnce() {
  const existing = await db.collection('programs').limit(1).get();
  if (!existing.empty) return;
  const now = new Date();
  const in10 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days
  const demo = [
    {
      title: 'Web Dev Bootcamp',
      company: 'Tech Youth',
      description: 'Build websites.',
      requirements: 'Basic computer use',
      skill_required: 'coding, teamwork, communication',
      duration: '6 weeks',
      location: 'Kingston',
      status: 'approved',
      ownerName: 'EmployerA',
      programType: 'advanced',
      roleOffered: 'remote',
      applicantLimit: 15,
      acceptedCount: 0,
      enrollmentMode: 'automatic',
      responseDeadline: in10.toISOString().slice(0, 10),
    },
    {
      title: 'Youth Mentorship',
      company: 'Bright Start',
      description: 'Support students.',
      requirements: 'Patience',
      skill_required: 'leadership, communication',
      duration: '8 weeks',
      location: 'Mandeville',
      status: 'approved',
      ownerName: 'EmployerB',
      programType: 'mentorship',
      roleOffered: 'part-time',
      applicantLimit: 20,
      acceptedCount: 0,
      enrollmentMode: 'manual',
      responseDeadline: '',
    },
    {
      title: 'Community Clean-Up',
      company: 'Civic Org',
      description: 'Beautify spaces.',
      requirements: 'Physical work',
      skill_required: 'teamwork',
      duration: '2 weeks',
      location: 'Kingston',
      status: 'approved',
      ownerName: 'EmployerA',
      programType: 'community',
      roleOffered: 'full-time',
      applicantLimit: 30,
      acceptedCount: 0,
      enrollmentMode: 'automatic',
      responseDeadline: in10.toISOString().slice(0, 10),
    },
  ];
  const batch = db.batch();
  demo.forEach((p) => batch.set(db.collection('programs').doc(), p));
  await batch.commit();
  console.log('Seeded demo programs.');
}
// seedProgramsOnce();


