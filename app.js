const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const mustache = require('mustache');

// If modifying these scopes, delete token.json.
const SCOPES     = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'token.json';
const SYNC_PATH  = 'synced.json';

var calendars = {};
var syncedEvents = [];

// {{{ Load synced events
if (fs.existsSync(SYNC_PATH)) {
  fs.readFile(SYNC_PATH, (err, content) => {
    if (err) {
      console.log('Error loading synced calendar file:', err);
      console.trace();
      return process.exit(1);
    }
    syncedEvents = JSON.parse(content);
  });
}
// }}}

// {{{ Load calendar ids
fs.readFile('calendars.json', (err, content) => {
  if (err) {
    console.log('Error loading calendar ids file:', err);
    console.trace();
    return process.exit(1);
  }
  var string = JSON.stringify(JSON.parse(content));
  calendars = JSON.parse(mustache.render(string, JSON.parse(string)));
  if (!(!!calendars.from)) {
    console.error('calendars.from not found');
    console.trace();
    return process.exit(1);
  }
  if (!(!!calendars.from.name)) {
    console.error('calendars.from.name not found');
    console.trace();
    return process.exit(1);
  }
  if (!(!!calendars.from.id)) {
    console.error('calendars.from.id not found');
    console.trace();
    return process.exit(1);
  }
  if (!(!!calendars.to) || !(!!calendars.to.id)) {
    console.error('calendars.to not found or does not contains id value');
    console.trace();
    return process.exit(1);
  }
  if (!(!!calendars.to.name)) {
    console.error('calendars.to.name not found');
    console.trace();
    return process.exit(1);
  }
  if (!(!!calendars.to.id)) {
    console.error('calendars.to.id not found');
    console.trace();
    return process.exit(1);
  }
  if (!(!!calendars.timeMin) || !(!!calendars.timeMin.iso)) {
    console.error('calendars.timeMin not found ot does not contains iso value');
    console.trace();
    return process.exit(1);
  }
});
// }}}

// {{{ Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) {
    console.log('Error loading client secret file:', err);
    console.trace();
    return process.exit(1);
  }
  // Authorize a client with credentials, then call the Google Calendar API.
  var authJson = JSON.parse(content);
  //authorize(authJson, listEvents);
  authorize(authJson, syncEvents);
});
// }}}

/**
 * {{{ Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}
// }}}

/**
 * {{{ Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error('Error retrieving access token', err);
        console.trace();
        return process.exit(1);
      }
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) {
          console.error(err);
          console.trace();
          return process.exit(1);
        }
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}
// }}}

/**
 * {{{ Lists the next on the `calendars.from`
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: calendars.from.id,
    timeMin: calendars.timeMin.iso,
    maxResults: calendars.maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      console.trace();
      return process.exit(1);
    }
    const events = res.data.items;
    if (events.length) {
      console.log("All calendar '"+calendars.from.name+"' events:");
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
      });
    } else {
      console.log('No events found.');
    }
  });
}
// }}}

/**
 * {{{ @function syncEvents
 */
function syncEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: calendars.from.id,
    timeMin: calendars.timeMin.iso,
    maxResults: calendars.maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      console.log(JSON.stringify(err));
      console.trace();
      return process.exit(1);
    }
    const events = res.data.items;
    if (events.length) {
      console.log(`Syncing events calendars from:${calendars.from.name} to:${calendars.to.name} :`);
      events.map((fromEvent, i) => {
        const start = fromEvent.start.dateTime || fromEvent.start.date;
        const eventString = `${start} - ${fromEvent.summary}`
        if (!isSynced(fromEvent)) {
          var event = makeTmpEvent(fromEvent);
          calendar.events.insert({
            auth: auth,
            calendarId: calendars.to.id,
            resource: event,
          }, function(err, data) {
            var toEvent = data.data;
            if (err) {
              console.log('There was an error contacting the Calendar service: ' + err);
              console.trace();
              return process.exit(1);
            }
            addSync(fromEvent, toEvent);
            console.log(`Event synced: ${eventString}`);
          });
        } else {
          console.log(`Event already synced: ${eventString}`);
        }
      });
    } else {
      console.log('No events found.');
    }
  });
}
// }}}

/**
 * {{{ @function addSync
 */
function addSync(fromEvent, toEvent) {
  var sync = {};
  sync.id = fromEvent.id;
  sync.updated = fromEvent.updated;
  sync.sync_id = toEvent.id;
  syncedEvents.push(sync);
  fs.writeFile(SYNC_PATH, JSON.stringify(syncedEvents), (err) => {
    if (err) {
      console.error(err);
      console.trace();
      return process.exit(1);
    }
  });

}
// }}}

/**
 * {{{ @functions isSynced
 */
function isSynced(event) {
  return syncedEvents.some((sync, i) => {
    return sync.id == event.id;
  });
}
// }}}

/**
 * {{{ @function makeTmpEvent
 * @param object as google json event
 * @return object event minified with only basic informations
 */
function makeTmpEvent(event) {
  var tmpEvent = {};
  tmpEvent.description = event.description;
  tmpEvent.end         = event.end;
  tmpEvent.start       = event.start;
  tmpEvent.summary     = "";
  if (!!calendars.prefix) {
    tmpEvent.summary  += `${calendars.prefix} - `;
  }
  tmpEvent.summary    += event.summary;
  tmpEvent.location    = event.location;
  return tmpEvent;
}
// }}}
