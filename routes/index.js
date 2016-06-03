var atob = require('atob'); 
var express = require('express');
var fs = require('fs');
var github = require('octonode');
var qs = require('querystring');
var url = require('url');
var settings;


var calmgr = require('../public/javascripts/calmgr.json');

var router = express.Router();

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
//
// G LO B A L   V A R I A B L E S
//
var me = {};
var calendar = {};

// Store info to verify against CSRF
var state;

// Fill in the calendar
function updateCalendarData(y,m,d) {

    // Update table header thead
    calendar.weekdays = getWeekDays(y,m,d);
    calendar.weeknum  = getISOWeekNum(y,m,d);
    calendar.events   = searchEvents();
    // console.log(JSON.stringify(calendar.events));
    
    function getWeekDays(y,m,d) {
        var months    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var shortdays = ['SUN','MON','TUE','WED','THU','FRI'];
        var weekdays=[];
        var date = new Date(y,m,d);
        for (var i=1; i<=5; i++) {
            var day = new Date(y,m,d - date.getDay() + i);
            weekdays.push({'day': shortdays[day.getDay()], 'date':day.getDate(),'month': months[day.getMonth()] } );
        }
        return weekdays;
    }
    
    /**
     * Get the ISO week date week number
     * From http://techblog.procurios.nl/k/n618/news/view/33796/14863/calculate-iso-8601-week-and-year-in-javascript.html
     * By Taco van den Broek
     */
    function getISOWeekNum(y,m,d) {
        var date = new Date(y,m,d);
	    // Create a copy of this date object
	    var target  = new Date(y,m,d);

	    // ISO week date weeks start on monday
	    // so correct the day number
	    var monday   = (date.getDay() + 6) % 7;

	    // ISO 8601 states that week 1 is the week
	    // with the first thursday of that year.
	    // Set the target date to the thursday in the target week
	    target.setDate(target.getDate() - monday + 3);

	    // Store the millisecond value of the target date
	    var firstThursday = target.valueOf();

	    // Set the target to the first thursday of the year
	    // First set the target to january first
	    target.setMonth(0, 1);
	    // Not a thursday? Correct the date to the next thursday
	    if (target.getDay() != 4) {
		    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
	    }

	    // The weeknumber is the number of weeks between the 
	    // first thursday of the year and the thursday in the target week
	    return 1 + Math.ceil((firstThursday - target) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000
    }
    
    function searchEvents() {
        var today = calendar.date;
        var weekevents = [];
        weekevents[0]=[]; // SUN
        weekevents[1]=[]; // MON
        weekevents[2]=[]; // TUE
        weekevents[3]=[]; // WED
        weekevents[4]=[]; // THU
        weekevents[5]=[]; // FRI
        
        // Search events occuring during this week 
        for (var index in calendar.data) {
            var element = calendar.data[index];
            var startDate = new Date(element.date_start);
            var endDate   = new Date(element.date_end);
            
            // From MON to FRI
            for (var i = 1; i < 6; i++) {
                var day = new Date(calendar.date.getFullYear(),calendar.date.getMonth(),calendar.date.getDate() - calendar.date.getDay() + i);
                var dayD       = day.toCalString().substr(0,10);       // Days number since UTC
                var startDateD = element.date_start.substr(0,10); // Days number since UTC
                var endDateD   = element.date_end.substr(0,10);   // Days number since UTC
                // console.log(dayD,startDateD,endDateD,calendar.date.getDate(),today.getDay(),day, day.toLocaleString());
                if ( dayD >= startDateD && dayD <= endDateD ) { // HACK: What about multi-days event ?
                    // console.log(day + ' creates an event with ' + element.ID + ' ' +  element.summary);
                    // Obsolete
                    // element.acronym = calmgr.courses[element.summary].acronym;
                    element.warnings = [];
                    if (element.lecturer === "------") {
                        element.warnings.push(" No lecturer!!");
                    }
                    if (element.location.search('None::None@') != -1) {
                        element.warnings.push(" No building!!");
                    }
                    if (element.location.search('@000') != -1) {
                        element.warnings.push(" No classroom!!");
                    }

                    element.hours = element.date_start.substr(11,5)+'-'+element.date_end.substr(11,5);
                    element.weekdayIndex = i;
                    weekevents[i].push(element);
                }
            }
        }
        
        // Sort events by time from 0800 to 1900
        for (var i = 1; i < 6; i++) {
            weekevents[i].sort(function sort(a,b) {
                if (a.date_start.substr(9,4) > b.date_start.substr(9,4) ) {
                    return 1;
                }
                else if (a.date_start.substr(9,4) < b.date_start.substr(9,4) ) {
                    return -1;
                }
                else {
                    if (a.weekdayIndex > b.weekdayIndex ) {
                        return 1;
                    }
                    else if (a.weekdayIndex < b.weekdayIndex ) {
                        return -1;
                    }
                    else
                        return 0;
                }
            });
        }
        return weekevents;
    }
}

    function createID(data, login) {
        // HACK console.log(data);
        var sem = data.acronym.substr(0,2) === "S07";
        var master_year = (data.acronym.substr(0,3) === "S07" || data.acronym.substr(0,3) === "S08" ) ? 1 : 2;
        console.log("MASTER YEAR " + data.acronym.substr(0,3) +" = "+master_year);
        console.log(tracks);
        var tracks = calmgr.courses[data.apogee].tracks.substr(2,2); // = 1+2+4 TODO: Must be set correctly or read from `courses` JSON description
        var ID = "C"+ master_year + tracks + new Date().toISOString().replace(/[-:.Z]/g,'') + "@" + login; 
        return ID;
    }
    
    function createCourse(data,ID) {
        var event = {};
        event.ID         = ID;
        event.apogee     = data.apogee;
        event.acronym    = data.acronym;
        event.type       = data.type;
        event.summary    = data.apogee;
        event.date_start = data.date + "T" + data.starthh + ':' + data.startmm;
        event.date_end   = data.date + "T" + data.endhh   + ':' + data.endmm;
        event.group      = data.group;
        event.lecturer   = data.lecturer;
        event.location   = data.location + "@" + data.room;
        event.description = "None";
        event.comment    = data.title; // Remove semester ???
        console.log('COURSE ' + JSON.stringify(event));
        
        return event;
    }

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
      res.render('settings', { });

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

router.get('/previousweek', function(req, res, next) {
    console.log('/previousweek');
    calendar.date.setDate(calendar.date.getDate() - 7);
    updateCalendarData(calendar.date.getFullYear(),calendar.date.getMonth(),calendar.date.getDate());
    res.render('calendar', 
        {
            'days': calendar.weekdays, 
            'weeknum': calendar.weeknum, 
            'events': calendar.events,
            'year': settings.default_year,
            'settings' : calmgr, 
            'menus': calmgr.menus
        }
    );    
});

router.get('/nextweek', function(req, res, next) {
    calendar.date.setDate(calendar.date.getDate() + 7);
    updateCalendarData(calendar.date.getFullYear(),calendar.date.getMonth(),calendar.date.getDate());
    res.render('calendar', 
        {
            'days': calendar.weekdays, 
            'weeknum': calendar.weeknum, 
            'events': calendar.events,
            'year': settings.default_year,
            'settings' : calmgr, 
            'menus': calmgr.menus
        }
    );    
});

router.get('/calendar', function(req, res, next) {
/******
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 0)) {
            calendar_data = JSON.parse(xhr.responseText); // Données textuelles récupérées
            processCalendarData();
        }
    };
    xhr.open("GET", "http://master-bioinfo-bordeaux.github.io/data/calendar.json", true);
    xhr.send(null);
****/

    me.client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io').contents('data/calendar.json', function(err, data, headers) {
        // console.log("error: " + err);
        // console.log("data: " +  JSON.stringify(data) );
        // console.log("headers:" + headers);
        calendar.data = JSON.parse(atob(data.content) );
        calendar.sha = data.sha;

        // console.log(JSON.stringify(calendar.data) );
        var now = new Date();
        calendar.date = now;
        updateCalendarData(now.getFullYear(), now.getMonth(), now.getDate());
        calmgr.menus = createMenus();
        res.render('calendar', 
            {
                'days': calendar.weekdays, 
                'weeknum': calendar.weeknum, 
                'events': calendar.events,
                'year': settings.default_year,
                'settings' : calmgr, 
                'menus': calmgr.menus
            }
        );
    
    });
    
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

router.post('/course', function(req, res, next) {
    console.log('POST course'+ JSON.stringify(req.body) );
    if (req.body.action === "Add Session") {
        // Upodate event object
        var new_session = parseInt(req.body.session);
        new_session++;
        var mod_event = createEventWithSessions(req.body);
        mod_event.session = new_session;
        
        // Copy from the data of the previous session except date
        mod_event.sessions[new_session - 1] = Object.create(mod_event.sessions[new_session - 2]);
        mod_event.sessions[new_session - 1].date = "";
        console.log(JSON.stringify(mod_event));
        res.render('course', {'event' : mod_event, 'settings': calmgr});
    }
    else if (req.body.action === "Create") {
        var events = createEventWithSessions(req.body);
        for (var i in events.sessions) {
            events.sessions[i].apogee = events.apogee;
            events.sessions[i].acronym = events.acronym;
            console.log(events.sessions[i]);
            var myID = createID(events.sessions[i],me.login);
            var e = createCourse(events.sessions[i], myID);
            // Add in the calendar
            calendar.data[e.ID] = e;
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

    function createEventWithSessions(data) {
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
        var keynames = ["type","lecturer","students","date","starthh","startmm","endhh","endmm","location","room"];
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
    

});


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
    
    event.apogee     = calmgr.events[theEventID].apogee;
    event.acronym    = calmgr.events[theEventID].acronym;
    event.summary    = event.apogee;
    event.title      = data.title;
    event.lecturer   = data.status + ' ' + data.name + ' '+ data.initials;
    event.year       = data.year;
    event.date_start = data.date + "T" + data.starthh + ':' + data.startmm;
    event.date_end   = data.date + "T" + data.endhh   + ':' + data.endmm;
    event.group      = data.group;
    event.location   = data.location + "@" + data.room;
    event.description = data.description;
    event.tracks     = '0x'+tracks.toString(16); 
    console.log('EVENT ' + JSON.stringify(event));

    calendar.data[event.ID] = event;
    var ghrepo = me.client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io');
    ghrepo.updateContents('data/calendar.json', 'New event', unescape(encodeURIComponent(JSON.stringify(calendar.data,null,2))), calendar.sha,function (err, token) {
        console.log('ERR '+err);
        console.log('TOK '+token);
        if (err === null) {
            res.redirect("/calendar");
        }

    });
});


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
        event = createCourse(data, data.ID);
    }
    else if (data.ID[0] === "E") {
        var tracks = parseInt(data.track0) + parseInt(data.track1) + parseInt(data.track2);
        console.log('TRACKS ' + tracks);
        event.apogee     = calmgr.events[data.type].apogee;
        event.acronym    = data.type; 
        event.summary    = event.apogee;
        event.title      = data.title;
        event.lecturer   = data.status + ' ' + data.name + ' '+ data.initials;
        event.year       = data.year;
        event.date_start = data.date + "T" + data.starthh + ':' + data.startmm;
        event.date_end   = data.date + "T" + data.endhh   + ':' + data.endmm;
        event.group      = data.group;
        event.location   = data.location + "@" + data.room;
        event.description = data.description;
        event.tracks     = '0x'+tracks.toString(16); 

    }
    calendar.data[data.ID] = event;
    var ghrepo = me.client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io');
    ghrepo.updateContents('data/calendar.json', 'New event', unescape(encodeURIComponent(JSON.stringify(calendar.data,null,2))), calendar.sha,function (err, token) {
        console.log('ERR '+err);
        console.log('TOK '+token);
        if (err === null) {
            res.redirect("/calendar");
        }

    });

});


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
    
            res.redirect('/calendar');
        });
    }

        // client.repo('master-bioinfo-bordeaux/master-bioinfo-bordeaux.github.io').createContents('data/empty.json', 'commit message', 'content', function (err, token) {
          // TODO
        // });


});



    
module.exports = router;


