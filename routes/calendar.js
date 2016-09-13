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
 
 function Calendar(db) {

    this.data; // Content of the calendar
    this.weekdays;
    this.weeknum;
    this.weekevents;
    this.filter = {};
    this.filter.year = 1;
    
    // Database (aka JSON) containing all the infos of courses + events
    this.database = {};
    this.database.courses = db.courses; 
    this.database.events  = db.events; 
    
    // Init calendar for actual week
    this.date = new Date(); // Now
    this.updateCalendarData();
};


// Fill in the calendar
Calendar.prototype.updateCalendarData = function(mYear) {

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
    
    var y = this.date.getFullYear();
    var m = this.date.getMonth();
    var d = this.date.getDate();
    
    // Update table header thead
    this.weekdays = getWeekDays(y,m,d);
    this.weeknum  = getISOWeekNum(y,m,d);
    this.weekevents   = this.searchWeekEvents(mYear);
    // console.log(JSON.stringify(this.events));

};


Calendar.prototype.searchAllSessions = function(apogee) {
    var sessionevents = [];
    for (var index in this.data) {
        var element = this.data[index];
        if (element.apogee === apogee) {
            sessionevents.push(element);
        }
    }
    return sessionevents;
};


Calendar.prototype.searchWeekEvents = function(mYear) {

    var weekevents = [];
    weekevents[0]=[]; // SUN
    weekevents[1]=[]; // MON
    weekevents[2]=[]; // TUE
    weekevents[3]=[]; // WED
    weekevents[4]=[]; // THU
    weekevents[5]=[]; // FRI
    
    // Search events occuring during this week 
    for (var index in this.data) {
        var element = this.data[index];
        // console.log(mYear + '<=>' + ( parseInt(element.ID[1]) & mYear));
        if ( ( parseInt(element.ID[1]) & mYear) === mYear) {
            var startDate = new Date(element.date_start);
            var endDate   = new Date(element.date_end);
            
            // From MON to FRI
            for (var i = 1; i < 6; i++) {
                var day = new Date(this.date.getFullYear(),this.date.getMonth(),this.date.getDate() - this.date.getDay() + i);
                var dayD       = day.toCalString().substr(0,10);  // Days number since UTC
                var startDateD = element.date_start.substr(0,10); // Days number since UTC
                var endDateD   = element.date_end.substr(0,10);   // Days number since UTC
                
                // console.log(dayD,startDateD,endDateD,this.date.getDate(),today.getDay(),day, day.toLocaleString());
                if ( dayD >= startDateD && dayD <= endDateD ) { // HACK: What about multi-days event ?
                    // console.log(day + ' creates an event with ' + element.ID + ' ' +  element.summary);
                    // Obsolete
                    // element.acronym = this.database.courses[element.summary].acronym;
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
};


Calendar.prototype.createID = function (data, login) {
    // HACK console.log(data);
    var sem = data.acronym.substr(0,2) === "S07";
    var master_year = (data.acronym.substr(0,3) === "S07" || data.acronym.substr(0,3) === "S08" ) ? 1 : 2;
    console.log("MASTER YEAR " + data.acronym.substr(0,3) +" = "+master_year);
    console.log(tracks);
    var tracks = this.database.courses[data.apogee].tracks.substr(2,2); // = 1+2+4 TODO: Must be set correctly or read from `courses` JSON description
    var ID = "C"+ master_year + tracks + new Date().toISOString().replace(/[-:.Z]/g,'') + "@" + login; 
    return ID;
};
    
Calendar.prototype.createCourse = function (data,ID) {
    var event = {};
    event.ID         = ID;
    event.apogee     = data.apogee;
    event.acronym    = data.acronym;
    event.type       = data.type;
    event.summary    = data.apogee;
    event.lecturer   = data.lecturer;
    event.date_start = data.date + "T" + data.starthh + ':' + data.startmm;
    event.date_end   = data.date + "T" + data.endhh   + ':' + data.endmm;
    event.group      = data.group;
    event.location   = data.location + "@" + data.roomamphi + '_' + data.number;
    event.description = "None";
    event.comment    = data.title; // Remove semester ???
    console.log('COURSE ' + JSON.stringify(event));
    
    this.data[ID] = event;
};

Calendar.prototype.createEvent = function (data,ID) {
    var event = {};
    event.ID         = ID;

    var tracks = parseInt(data.track0) + parseInt(data.track1) + parseInt(data.track2);
    console.log('TRACKS ' + tracks);
    event.apogee     = this.database.events[data.type].apogee;
    event.acronym    = this.database.events[data.type].acronym; 
    event.type       = data.type; 
    event.summary    = event.apogee;
    event.title      = data.title;
    event.lecturer   = data.status + ' ' + data.name + ' '+ data.initials;
    event.year       = data.year;
    event.date_start = data.date + "T" + data.starthh + ':' + data.startmm;
    event.date_end   = data.date + "T" + data.endhh   + ':' + data.endmm;
    event.group      = data.group;
    event.location   = data.location + "@" + data.roomamphi + '_' + data.number;
    event.description = data.description;
    event.tracks     = '0x'+tracks.toString(16); 
    
    this.data[ID] = event;
};
 
exports.Calendar = Calendar


