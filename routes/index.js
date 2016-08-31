/*
 *  calendarMgr: Manager of master-bioinfo-bordeaux calendar
 *  Copyright (C) 2016  Jean-Christophe Taveau.
 *
 *  This file is part of calendarMgr
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with mowgli.  If not, see <http://www.gnu.org/licenses/>.
 *
 *
 * Authors:
 * Jean-Christophe Taveau
 */
 
 
var atob = require('atob'); 
var express = require('express');
var fs = require('fs');
var github = require('octonode');
var qs = require('querystring');
var url = require('url');


//
// G LO B A L   V A R I A B L E S
//

var settings;

var calmgr = require('../public/javascripts/calmgr.json');
var mCal = require('./calendar');

// Polyfill
if ( !Date.prototype.toCalString ) {
  ( function() {
    
    function pad(number) {
      if ( number < 10 ) {
        return '0' + number;
      }
      return number;
    }
 
    Date.prototype.toCalString = function() {
      return this.getFullYear() +
        '-' + pad( this.getMonth() + 1 ) +
        '-' + pad( this.getDate() ) +
        'T' + pad( this.getHours() ) +
        ':' + pad( this.getMinutes() ) +
        ':' + pad( this.getSeconds() ) +
        '.' + (this.getMilliseconds() / 1000).toFixed(3).slice(2, 5);
    };
  
  }() );
}


/* GLOBAL */

var router = express.Router();
var me = {};
var calendar = new mCal.Calendar(calmgr);


// Store info to verify against CSRF
var state;


/**********************************************************
 *
 * IDs, login, authentification, etc.
 *
 **********************************************************/
 
 
/* GET index main page. */
router.get('/', function(req, res, next) {
    try {
        settings = require('../settings.json');
    }
    catch (e) {
        console.log('settings not defined. Must be done');
        res.redirect("/settings");
    }
    settings = require('../settings.json');

    // Redirecting to github login
    res.redirect("/login");

});

/* GET settings page. */
router.get('/settings', function(req, res, next) {
    if (settings === undefined) {
        res.render('settings', {settings: {'id':0} });
    }else {
        res.render('settings', {settings: settings});
    }


});

/* POST settings page. */
router.post('/settings', function(req, res, next) {
    var answer = JSON.stringify(req.body,"\t");
    console.log('SETTINGS ' + answer);
    fs.writeFile("settings.json", answer, function(err) {
        if(err) {
            return console.log('ERR FILE: ' + err);
        }

        console.log("The file was saved!");
    }); 

});

/* GET login page. */
router.get('/login', function(req, res, next) {
    console.log('login');
    // Redirecting to github login
    var config = {
        id : settings.id,
        secret: settings.secret,
        redirect_uri: settings.redirect_uri
    };
    var Oauth2 = github.auth.config(config).login(['user', 'repo']);
    state = Oauth2.match(/&state=([0-9a-z]{32})/i);
    res.writeHead(302, {'Content-Type': 'text/plain', 'Location': Oauth2})
    res.end('Redirecting to ' + Oauth2);

});

/*************
router.get('/auth/github',function(req,res){
   res.writeHead(303, {
     Location: OAuth2.getAuthorizeUrl({
       redirect_uri: 'http://127.0.0.1:3000/auth/github/callback',
       scope: "user,repo,gist"
     })
    });
    res.end();
});
***********/

router.get('/auth/github/callback',function (req, res) {
    console.log('auth');
    var uri = url.parse(req.url);
    var values = qs.parse(uri.query);
    console.log(uri.query);
    console.log('state '+state);
    
    // Check against CSRF attacks
    if (!state || state[1] != values.state) {
        res.writeHead(403, {'Content-Type': 'text/plain'});
        res.end('');
    } else {
        github.auth.login(values.code, function (err, token) {
            me.client = github.client(token);
            /***
            me.client.get('/user', {}, function (err, status, body, headers) {
                console.log(body); //json object
            });
            ***/
            
            // Get info about the github user
            me.client.me().info(function(err, data, headers) {
                me.login = data.login;
            });
    
            res.redirect('/init');
        });
    }
});

router.get('/init', function(req, res, next) {

    // Get calendar data in github
    me.client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io').contents('data/calendar.json', function(err, data, headers) {
        calendar.data = JSON.parse(atob(data.content) );
        calendar.sha = data.sha;
        
        res.redirect('/calendar');
    });

});


/**********************************************************
 *
 * Management of main view calendar
 *
 **********************************************************/
 

router.get('/calendar', function(req, res, next) {

    function createMenus() {
        var menus = {};
        menus.s06 = [{"apogee": "None", "name": "None"}];
        menus.s07 = []; menus.s08 = []; menus.s09 = []; menus.s10 = [];
        menus.s11 = [{"apogee": "Event", "name": "Event"}];
        menus.s07.push({"apogee": "None", "name": "S07::None"});
        menus.s08.push({"apogee": "None", "name": "S08::None"});
        menus.s09.push({"apogee": "None", "name": "S09::None"});
        menus.s10.push({"apogee": "None", "name": "S10::None"});
        for (var key in calmgr.courses) {
            var course = calmgr.courses[key];
            if (course.acronym.substr(0,3) === "S07") {
                menus.s07.push({"apogee": course.apogee, "name": course.acronym});
            }
            else if (course.acronym.substr(0,3) === "S08") {
                menus.s08.push({"apogee": course.apogee, "name": course.acronym});
            }
            else if (course.acronym.substr(0,3) === "S09") {
                menus.s09.push({"apogee": course.apogee, "name": course.acronym});
            }
            else if (course.acronym.substr(0,3) === "S10") {
                menus.s10.push({"apogee": course.apogee, "name": course.acronym});
            }
        }
        return menus;
    }
    
    var myYear;
    if (req.query.year === undefined) {
        mYear = parseInt(settings.default_year) || 0;
    }
    else {
        mYear = parseInt(req.query.year);
    }
    settings.default_year = mYear;
    
    // console.log(JSON.stringify(calendar.data) );
    var now = new Date();
    if (calendar.weeknum === undefined) {
        calendar.date = now;
    }

    calendar.updateCalendarData(mYear);
    calmgr.menus = createMenus();
    res.render('calendar', 
        {
            'days': calendar.weekdays, 
            'weeknum': calendar.weeknum, 
            'events': calendar.weekevents,
            'year': settings.default_year,
            'settings' : calmgr, 
            'menus': calmgr.menus
        }
    );

});

router.post('/calendar', function(req, res, next) {
    console.log('POST '+ JSON.stringify(req.body) );
    var answer = JSON.stringify(req.body);
    
    var apogee = '';
    var title = 'unknown';
    switch (req.body.sem) {
    case '7':
        apogee = req.body.S7; 
        title = getTitle(apogee,calmgr.courses);
        break;
    case '8':
        apogee = req.body.S8;
        title = getTitle(apogee,calmgr.courses);
        break;
    case '9':
        apogee = req.body.S9;
        title = getTitle(apogee,calmgr.courses);
        break;
    case '10':
        apogee = req.body.S10; 
        title = getTitle(apogee,calmgr.courses);
        break;
    case '11':
        apogee = "New"; 
        title = "Event";
        break;
    }
    console.log(apogee);
    // 1- Get course sessions if available
    // 2- Render page with sessions history 
    // console.log('calmgr ' + JSON.stringify(calmgr));
    var new_event = {
        'acronym' : title,
        'summary': apogee
    }
    if (apogee === "New") {
        res.render('event', {'event' : new_event, 'settings': calmgr} );
    }
    else if (apogee !== '') {
        // Add session props
        new_event.apogee = apogee;
        new_event.sessions = [];
        new_event.sessions[0] = {};
        new_event.sessions[0].location = "None::None";
        new_event.sessions[0].room = "000";
        new_event.session = 1;

        res.render('course', {'event' : new_event, 'settings': calmgr});
    }
    // No course or event chosen. An alert could be sent TODO
    res.redirect('/calendar');

    function getTitle(entry,list) {
        return list[entry].acronym || 'unknown';
    }
    
});


/**********************************************************
 *
 * Management of previousweek + nextweek + gotoweek
 *
 **********************************************************/
 
router.get('/previousweek', function(req, res, next) {
    calendar.date.setDate(calendar.date.getDate() - 7);
    res.redirect('/calendar');
});

router.get('/nextweek', function(req, res, next) {
    calendar.date.setDate(calendar.date.getDate() + 7);
    res.redirect('/calendar');  
});

router.post('/gotoweek', function(req, res, next) {

    function getDateOfISOWeek(w, y) {
        var simple = new Date(y, 0, 1 + (w - 1) * 7);
        var dow = simple.getDay();
        var ISOweekStart = simple;
        if (dow <= 4)
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        else
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        return ISOweekStart;
    }

    calendar.date = getDateOfISOWeek(req.body.week,calendar.date.getFullYear());

    res.redirect('/calendar');  
});



/**********************************************************
 *
 * Management of course(s)
 *
 **********************************************************/
 
router.post('/course', function(req, res, next) {

    function addEventWithSessions(data) {
        var mod_event = {
            'acronym' : data.acronym,
            'apogee'  : data.apogee,
            "sessions": [],
            'session' : data.session
        }
        var keys = Object.keys(data).sort();
        // Init
        for (var i = 0; i < mod_event.session; i++) {
            mod_event.sessions[i]= {};
        }
        // Fill in session(s)
        var keynames = ["type","lecturer","group","date","starthh","startmm","endhh","endmm","location","room"];
        for (var i=0; i < keys.length; i++) {
            for (var j=0; j < keynames.length; j++) {
                if (keys[i].indexOf(keynames[j]) != -1) {
                    // Get index
                    var index = parseInt(keys[i].replace(/\D/g, '') );
                    mod_event.sessions[index][keynames[j]] = data[keys[i]];
                }
            }
        }
        return mod_event;
    }
    
    
    console.log('POST course'+ JSON.stringify(req.body) );
    if (req.body.action === "Add Session") {
        // Upodate event object
        var new_session = parseInt(req.body.session);
        new_session++;
        var mod_event = addEventWithSessions(req.body);
        mod_event.session = new_session;
        
        // Copy from the data of the previous session except date
        mod_event.sessions[new_session - 1] = Object.create(mod_event.sessions[new_session - 2]);
        mod_event.sessions[new_session - 1].date = "";
        console.log(JSON.stringify(mod_event));
        res.render('course', {'event' : mod_event, 'settings': calmgr});
    }
    else if (req.body.action === "Create") {
        var events = addEventWithSessions(req.body);
        for (var i in events.sessions) {
            events.sessions[i].apogee = events.apogee;
            events.sessions[i].acronym = events.acronym;
            console.log(events.sessions[i]);
            var myID = calendar.createID(events.sessions[i],me.login);

            // Add in the calendar
            // calendar.data[e.ID] = e;
            calendar.createCourse(events.sessions[i], myID);
            
            console.log(JSON.stringify(calendar.data));
        }
        // Update github data/calendar.json
        var ghrepo = me.client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io');
        console.log('REPO ' + ghrepo);
        console.log('SHA ' + calendar.sha);
        ghrepo.updateContents('data/calendar.json', 'New Event', JSON.stringify(calendar.data,null,2), calendar.sha,function (err, token) {
            console.log('ERR '+err);
            console.log('TOK '+token);
            if (err === null) {
                res.redirect("/calendar");
            }
        });
    }

});

/**********************************************************
 *
 * Management of event (non-course events) )
 *
 **********************************************************/
 
router.get('/event', function(req, res, next) {
    res.render('event', {'year': settings.default_year,'setting' : calmgr});
});


router.post('/event', function(req, res, next) {
    var prefix = '4TBI';
    console.log('POST event '+ JSON.stringify(req.body) );
    var data = req.body;
    var event = {};
    var tracks = parseInt(data.track0) + parseInt(data.track1) + parseInt(data.track2);
 
    //Clean, preprocess,etc.
    if (data.room === '' || data.room === undefined) {
        data.room = '000';
    }
    event.ID = "E"+ data.year + tracks.toString(16) + new Date().toISOString().replace(/[-:.Z]/g,'') + "@" + me.login; 
    var theEventID   = calmgr.eventTypes[data.type];
    
    calendar.createEvent(data,event.ID);
    
    var ghrepo = me.client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io');
    ghrepo.updateContents('data/calendar.json', 'New event', unescape(encodeURIComponent(JSON.stringify(calendar.data,null,2))), calendar.sha,function (err, token) {
        console.log('ERR '+err);
        console.log('TOK '+token);
        if (err === null) {
            res.redirect("/calendar");
        }

    });
});

/**********************************************************
 *
 * Display all the sessions of a given course
 *
 **********************************************************/
 
router.get('/sessions', function(req, res, next) {
    var id= req.query.id;

    if (id[0] === "C") {
        var apogee = calendar.data[id].apogee;
        var sessions = calendar.searchAllSessions(apogee);
        sessions.sort(function sort(a,b) {
            if (a.date_start > b.date_start ) {
                return 1;
            }
            else if (a.date_start < b.date_start ) {
                return -1;
            }
            else {
                return 0;
            }
        });
        console.log(sessions);
        res.render('course_sessions', {'sessions' : sessions, 'settings': calmgr});
    }
    else if (id[0] === "E") {
        // TODO res.render('event_sessions', {'event' : calendar.data[id], 'settings': calmgr});
    }

});

/**********************************************************
 *
 * Modify the given session
 *
 **********************************************************/

router.get('/modify', function(req, res, next) {
    var id= req.query.id;
    
    // Obsolete
    // calendar.data[id].acronym = calmgr.courses[calendar.data[id].summary].acronym;
    
/***
    TODO: Must be improved!!!
    var answer = calendar.data[id].location.match(/(.+)@/);
    calendar.data[id].locationBuilding = answer[1];
    answer = calendar.data[id].location.match(/@(\d+)/);
    calendar.data[id].locationRoom = answer[1];
***/

    if (id[0] === "C") {
        console.log(calendar.data[id]);
        res.render('course_modify', {'event' : calendar.data[id], 'settings': calmgr});
    }
    else if (id[0] === "E") {
        res.render('event_modify', {'event' : calendar.data[id], 'settings': calmgr});
    }

});

router.post('/modify', function(req, res, next) {
    console.log('POST modify '+ JSON.stringify(req.body) );
    var data = req.body;
    var event = {};
    event.ID = data.ID;
    if (data.ID[0] === "C") {
        calendar.createCourse(data, data.ID);
    }
    else if (data.ID[0] === "E") {
        calendar.createEvent(data, data.ID);
    }
    // calendar.data[data.ID] = event;
    var ghrepo = me.client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io');
    ghrepo.updateContents('data/calendar.json', 'New event', unescape(encodeURIComponent(JSON.stringify(calendar.data,null,2))), calendar.sha,function (err, token) {
        console.log('ERR '+err);
        console.log('TOK '+token);
        if (err === null) {
            res.redirect("/calendar");
        }

    });

});

/**********************************************************
 *
 * Delete the given session
 *
 **********************************************************/


router.get('/delete', function(req, res, next) {
    console.log('delete GET '+ req.query.id );
    delete calendar.data[req.query.id];
    var ghrepo = me.client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io');
    ghrepo.updateContents('data/calendar.json', 'Delete event', unescape(encodeURIComponent(JSON.stringify(calendar.data,null,2))), calendar.sha,function (err, token) {
        console.log('ERR '+err);
        console.log('TOK '+token);
        if (err === null) {
            res.redirect("/calendar");
        }

    });
});





    
module.exports = router;




