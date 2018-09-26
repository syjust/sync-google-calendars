Description
====

This node script copy events from a calendar to another with prefix (if defined in conf file : *calendars.json*).

@see :
* **Limitations** to see possibles disadvantages and problems when you will launch scripts
* **TODO** section to see next features in pipe.

**USE THIS SCRIPT AT YOUR OWN RISK**

Installation
====

clone the project then launch following commands into the project root path.

`npm install googleapi@27 --save`

`npm install mustache --save`

From console.google.com :

* Swith on th calendar api
* Then, import your credentials.json

Configuration
====

`cp calendars.json-sample calendars.json`

Edit calendars.json with your prefered editor and set your own values for :

* prefix
* from
* to

Note : you can use backreference according to Mustache.render allow it ({{ }}).

Launch application
====

`node app.js`

When you launch application :

* If token does not exits, it is interactively created (open given URL then copy the password into your console)
* *from calendar* events are copied (with prefix if any) into *to calendar*

TODO
====

* Check max connexion for google API (Use exponential backoff when Rate Limit Exceeded is catched),
* Allow app.js arguments to use listEvents instead syncEvents as default action,
* Do not __process.exit()__ on error inside callback actions,
* Allow multiple sync for same events if *updated date* changes. (finalize the local synced.json file usage)

Limitations
====

For moment, there is no possibility to launch script multiple time without *DUPLICATE CREATIONS*.
Take care to test with minimal list before launch (use *maxResults: 1,* into calendars.json if necessary)
