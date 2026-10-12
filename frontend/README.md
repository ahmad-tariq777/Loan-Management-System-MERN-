# Akhuwat LMS Frontend

React 19 with Create React App.

## Local

1. `npm install`
2. `npm start`

`/api` requests are proxied to `http://localhost:5000` through the `proxy` field in `package.json`.

## Deploy to Vercel and connect to the backend

1. Deploy the backend project first and copy its URL, for example `https://lms-backend.vercel.app`
2. In `vercel.json`, replace `https://YOUR-BACKEND.vercel.app` with that URL
3. Import this folder as its own Vercel project (framework preset: Create React App) and deploy
4. In the backend project, set `CLIENT_ORIGIN` to this frontend's URL and redeploy it

The frontend calls `/api` on its own domain and Vercel forwards those requests to the backend, so login cookies stay first-party and work in every browser. If you would rather call the backend directly, set `REACT_APP_API_URL` to `https://YOUR-BACKEND.vercel.app/api` and set `COOKIE_SAMESITE=none` on the backend.
