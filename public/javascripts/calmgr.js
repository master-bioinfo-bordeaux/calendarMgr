


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
    console.log(index);
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
