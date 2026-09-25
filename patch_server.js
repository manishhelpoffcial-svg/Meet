const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  `room.presenter.ws.send(JSON.stringify({ type: 'COMMAND_START_BROADCAST' }));`,
  `room.presenter.ws.send(JSON.stringify({ type: 'COMMAND_START_BROADCAST' }));
    room.viewers.forEach((v) => {
      if (v.ws.readyState === 1 /* OPEN */) {
        room.presenter.ws.send(JSON.stringify({ type: 'VIEWER_JOINED', viewerId: v.id }));
      }
    });`
);
fs.writeFileSync('server.ts', code);
