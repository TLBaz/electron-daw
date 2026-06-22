# Electron DAW

## Run (dev)
```bash
cd home/ubuntu
npm install
npm run start
```

## Build (release)
```bash
cd home/ubuntu
npm run build
```

The Windows installer is typically produced in `home/ubuntu/dist/`.

## Notes
- MongoDB is optional for UI startup. The app logs a warning if `mongodb://localhost:27017/electronDAW` is not available.

