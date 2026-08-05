# Live Scoreboard Setup

GitHub Pages can host the website, but it cannot store shared scores by itself. Use Firebase Realtime Database for live scores across phones.

## 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Create a project.
3. Add a Web App.
4. Copy the Firebase config.

## 2. Enable Realtime Database

1. In Firebase, open Build > Realtime Database.
2. Create a database.
3. Choose a region near you.
4. Start in test mode while testing.

## 3. Add Database Rules

Use these simple rules for a lightweight event scoreboard:

```json
{
  "rules": {
    "sessions": {
      "$sessionId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Anyone with a scoreboard link can edit that session's scores. For casual pickleball sessions this is usually fine. For stricter control, add login later.

## 4. Paste Firebase Config

Open `firebase-config.js` and replace `null` with your config:

```js
window.TICKLEPICKLE_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Upload `firebase-config.js` with `index.html`, `styles.css`, and `script.js`.

## 5. Use It

1. Generate your matches.
2. Click Share Link.
3. Send the generated scoreboard link to players.
4. Scores entered on one phone should update on other phones.
