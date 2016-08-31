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
 


function addSemesterCourse() {
    console.log(document.getElementById("sem").value);
    // Reset 
    document.getElementById("S6").style.display="none";
    document.getElementById("S7").style.display="none";
    document.getElementById("S8").style.display="none";
    document.getElementById("S9").style.display="none";
    document.getElementById("S10").style.display="none";
    document.getElementById("S11").style.display="none";
    // Display the good item
    var name = "S"+document.getElementById("sem").value;
    console.log(name);
    document.getElementById(name).style.display="inline-block";
    
}

function addEntryCourse(index) {
    console.log(index+' ['+last_session+']');
    var current = "session"+ index;
    var next    = "session"+(index+1);
    var element = document.getElementById(next);
    element.style.display="block";
    var items = document.querySelectorAll('#' + current + ' .contents');
    for (var i = 0; i < items.length;i++) {
        console.log(items[i].value);
    }
    console.log(element.children);
}
