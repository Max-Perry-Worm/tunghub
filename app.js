
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  increment,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ----------------------------------
// GLOBAL VARIABLES
// ----------------------------------

let currentUser = null;
let activeVideo = null;
let unsubscribeComments = null;
let unsubscribeVideos = null;

let videos = [];
let videoLiked = false;

const $ = id => document.getElementById(id);

// ----------------------------------
// AUTHENTICATION
// ----------------------------------

onAuthStateChanged(auth, user => {
  currentUser = user;

  $("accountButton").textContent =
    user ? "My Account" : "Sign In";

  loadVideos();
});

// ----------------------------------
// PAGE NAVIGATION
// ----------------------------------

window.showPage = function(page) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.add("hidden");
  });

  $(page).classList.remove("hidden");

  if (page === "stars") loadStars();
  if (page === "home" || page === "videos") renderVideos();
};

// ----------------------------------
// REGISTER
// ----------------------------------

window.register = async function() {
  try {
    const name = $("starName").value.trim();

    if (!name) {
      throw new Error("Choose a TungStar name.");
    }

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        $("email").value,
        $("password").value
      );

    await setDoc(
      doc(db, "tungstars", credential.user.uid),
      {
        uid: credential.user.uid,
        name,
        bio: "Welcome to my TungStar channel!",
        subscribers: 0,
        createdAt: serverTimestamp()
      }
    );

    $("authStatus").textContent =
      "Welcome to TungHub!";

    showPage("home");

  } catch(error) {
    $("authStatus").textContent = error.message;
  }
};

// ----------------------------------
// LOGIN
// ----------------------------------

window.login = async function() {
  try {
    await signInWithEmailAndPassword(
      auth,
      $("email").value,
      $("password").value
    );

    $("authStatus").textContent = "Logged in!";
    showPage("home");

  } catch(error) {
    $("authStatus").textContent = error.message;
  }
};

// ----------------------------------
// LOGOUT
// ----------------------------------

window.logout = async function() {
  await signOut(auth);
  showPage("home");
};

// ----------------------------------
// VIDEO UPLOAD - FIRESTORE ONLY
// ----------------------------------

window.uploadVideo = async function() {
  if (!currentUser) {
    alert("Sign in first!");
    return;
  }

  const file = $("videoFile").files[0];
  const title = $("videoTitle").value.trim();
  const description = $("videoDescription").value.trim();

  if (!file || !title) {
    alert("Enter a title and select a video.");
    return;
  }

  // Keep encoded video below Firestore's document limit.
  if (!file.type.startsWith("video/") ||
      file.size > 500 * 1024) {
    alert("Video must be under 500 KB.");
    return;
  }

  const status = $("uploadStatus");
  status.textContent = "Preparing video...";

  const reader = new FileReader();

  reader.onload = async () => {
    try {
      const profile = await getDoc(
        doc(db, "tungstars", currentUser.uid)
      );

      await addDoc(collection(db, "videos"), {
        title,
        description,
        uid: currentUser.uid,
        creator: profile.data()?.name || "TungStar",
        type: $("videoType").value,
        videoData: reader.result,
        likes: 0,
        createdAt: serverTimestamp()
      });

      status.textContent = "Upload successful!";

      $("videoTitle").value = "";
      $("videoDescription").value = "";
      $("videoFile").value = "";

      showPage("home");

    } catch(error) {
      status.textContent = error.message;
    }
  };

  reader.onerror = () => {
    status.textContent = "Could not read video.";
  };

  reader.readAsDataURL(file);
};

// ----------------------------------
// LOAD VIDEOS
// ----------------------------------

function loadVideos() {
  if (unsubscribeVideos) unsubscribeVideos();

  const q = query(
    collection(db, "videos"),
    orderBy("createdAt", "desc")
  );

  unsubscribeVideos = onSnapshot(q, snapshot => {

    videos = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderVideos();

  }, error => {
    console.error("Video feed error:", error);
  });
}

// ----------------------------------
// SAFE HTML
// ----------------------------------

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

// ----------------------------------
// VIDEO FEED
// ----------------------------------

function renderVideos() {

  const makeCards = list => list.map(v => `
    <article class="video-card">

      <video
        src="${escapeHTML(v.videoData || "")}"
        preload="none"
        muted
        onclick="watchVideo('${v.id}')">
      </video>

      <h3>${escapeHTML(v.title)}</h3>

      <p>${escapeHTML(v.creator)}</p>

      <button onclick="watchVideo('${v.id}')">
        Watch Video
      </button>

    </article>
  `).join("");

  $("homeVideos").innerHTML =
    makeCards(videos.slice(0, 8));

  $("allVideos").innerHTML =
    makeCards(videos.filter(v => v.type === "video"));
}

// ----------------------------------
// SEARCH
// ----------------------------------

window.searchVideos = function() {
  const term = $("search").value.toLowerCase();

  const results = videos.filter(v =>
    (v.title + " " + v.creator)
      .toLowerCase()
      .includes(term)
  );

  $("allVideos").innerHTML = results.map(v => `
    <article class="video-card">
      <h3>${escapeHTML(v.title)}</h3>
      <p>${escapeHTML(v.creator)}</p>
      <button onclick="watchVideo('${v.id}')">
        Watch
      </button>
    </article>
  `).join("");

  showPage("videos");
};

// ----------------------------------
// VIDEO PLAYER
// ----------------------------------

window.watchVideo = async function(id) {

  activeVideo = videos.find(v => v.id === id);

  if (!activeVideo) return;

  showPage("watch");

  $("watchTitle").textContent = activeVideo.title;
  $("watchCreator").textContent =
    "By " + activeVideo.creator;

  $("watchDescription").textContent =
    activeVideo.description || "";

  const player = $("player");

  player.pause();
  player.dataset.stage = "intro";

  // Play intro first.
  player.src = "./IMG_8095.mp4";
  player.load();

  try {
    await player.play();
  } catch(error) {
    console.error("Intro playback failed:", error);
  }

  // Remove previous comment listener.
  if (unsubscribeComments) {
    unsubscribeComments();
  }

  const q = query(
    collection(db, "videos", id, "comments"),
    orderBy("createdAt", "asc")
  );

  unsubscribeComments = onSnapshot(q, snapshot => {

    $("comments").innerHTML =
      snapshot.docs.map(d => {

        const c = d.data();

        return `
          <div class="comment">
            <strong>${escapeHTML(c.author)}</strong>
            <p>${escapeHTML(c.text)}</p>
          </div>
        `;

      }).join("");

  });

  videoLiked = false;

  $("likeButton").textContent =
    `♥ ${activeVideo.likes || 0} Likes`;
};

// ----------------------------------
// INTRO FINISHED -> MAIN VIDEO
// ----------------------------------

$("player").addEventListener("ended", function() {

  if (this.dataset.stage === "intro") {

    this.dataset.stage = "video";

    this.src = activeVideo.videoData;
    this.load();

    this.play().catch(console.error);
  }

});

// ----------------------------------
// COMMENTS
// ----------------------------------

window.postComment = async function() {

  if (!currentUser) {
    alert("Sign in to comment.");
    return;
  }

  if (!activeVideo) return;

  const text = $("commentInput").value.trim();

  if (!text || text.length > 2000) return;

  try {
    const profile = await getDoc(
      doc(db, "tungstars", currentUser.uid)
    );

    await addDoc(
      collection(
        db,
        "videos",
        activeVideo.id,
        "comments"
      ),
      {
        uid: currentUser.uid,
        author: profile.data()?.name || currentUser.email,
        text,
        createdAt: serverTimestamp()
      }
    );

    $("commentInput").value = "";

  } catch(error) {
    alert(error.message);
  }
};

// ----------------------------------
// LIKES
// ----------------------------------

window.likeVideo = async function() {

  if (!currentUser) {
    alert("Sign in to like videos.");
    return;
  }

  if (!activeVideo) return;

  const videoRef = doc(db, "videos", activeVideo.id);

  const likeRef = doc(
    db,
    "videos",
    activeVideo.id,
    "likes",
    currentUser.uid
  );

  try {
    await runTransaction(db, async transaction => {

      const existing = await transaction.get(likeRef);

      if (existing.exists()) return;

      const video = await transaction.get(videoRef);

      if (!video.exists()) {
        throw new Error("Video not found.");
      }

      transaction.set(likeRef, {
        uid: currentUser.uid,
        createdAt: serverTimestamp()
      });

      transaction.update(videoRef, {
        likes: increment(1)
      });
    });

    videoLiked = true;

    activeVideo.likes =
      (activeVideo.likes || 0) + 1;

    $("likeButton").textContent =
      `♥ ${activeVideo.likes} Likes`;

  } catch(error) {
    alert(error.message);
  }
};

// ----------------------------------
// TUNGSTARS
// ----------------------------------

async function loadStars() {

  const snapshot = await getDocs(
    collection(db, "tungstars")
  );

  $("allStars").innerHTML =
    snapshot.docs.map(d => {

      const star = d.data();

      return `
        <article class="star-card">

          <h3>⭐ ${escapeHTML(star.name)}</h3>

          <p>${escapeHTML(star.bio)}</p>

          <p>${star.subscribers || 0} subscribers</p>

          <button onclick="openChannel('${d.id}')">
            View Channel
          </button>

          <button onclick="subscribe('${d.id}')">
            Subscribe
          </button>

        </article>
      `;

    }).join("");
}

// ----------------------------------
// CREATOR CHANNEL
// ----------------------------------

window.openChannel = async function(uid) {

  const profile = await getDoc(
    doc(db, "tungstars", uid)
  );

  if (!profile.exists()) return;

  const star = profile.data();

  $("channelInfo").innerHTML = `
    <h2>⭐ ${escapeHTML(star.name)}</h2>
    <p>${escapeHTML(star.bio)}</p>
    <p>${star.subscribers || 0} subscribers</p>
  `;

  const channelVideos = videos.filter(
    v => v.uid === uid
  );

  $("channelVideos").innerHTML =
    channelVideos.map(v => `
      <article class="video-card">
        <h3>${escapeHTML(v.title)}</h3>
        <button onclick="watchVideo('${v.id}')">
          Watch
        </button>
      </article>
    `).join("");

  showPage("channel");
};

// ----------------------------------
// SUBSCRIBE
// ----------------------------------

window.subscribe = async function(uid) {

  if (!currentUser) {
    alert("Sign in to subscribe.");
    return;
  }

  if (currentUser.uid === uid) return;

  const subRef = doc(
    db,
    "tungstars",
    uid,
    "subscribers",
    currentUser.uid
  );

  const profileRef = doc(
    db,
    "tungstars",
    uid
  );

  try {

    await runTransaction(db, async transaction => {

      const existing = await transaction.get(subRef);

      if (existing.exists()) return;

      const profile = await transaction.get(profileRef);

      if (!profile.exists()) {
        throw new Error("TungStar not found.");
      }

      transaction.set(subRef, {
        uid: currentUser.uid,
        createdAt: serverTimestamp()
      });

      transaction.update(profileRef, {
        subscribers: increment(1)
      });

    });

    await loadStars();

  } catch(error) {
    alert(error.message);
  }
};

// ----------------------------------
// INITIALIZE
// ----------------------------------

showPage("home");
loadStars();
