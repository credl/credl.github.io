function getParameterByName(name, url) {
	if (!url) url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
	results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function includeExtHtml() {
	var divs, div, i, exthtmlfile, xhttp;
	// for all divs with ext-html attribute
	divs = document.getElementsByTagName("div");
	for (i = 0; i < divs.length; i++) {
		div = divs[i];
		// extract ext-html attribute
		exthtmlfile = div.getAttribute("ext-html");
		if (exthtmlfile) {
			// HTTP request to this file
			xhttp = new XMLHttpRequest();
			xhttp.onreadystatechange = function() {
				if (this.readyState == 4) {
					if (this.status == 200) {
						div.innerHTML = this.responseText;
					} else if (this.status == 404) {
						div.innerHTML = "Menu page not found";
					}
					// remove the ext-html attribute (non-recursive version of this function suffices)
					div.removeAttribute("ext-html");
				}
			}
			xhttp.open("GET", exthtmlfile, false);
			xhttp.send();
		}
	}
}

function setCookie(cname, cvalue, exdays) {
	var d = new Date();
	d.setTime(d.getTime() + (exdays*24*60*60*1000));
	var expires = "expires="+ d.toUTCString();
	cookieString = encodeURIComponent(cname + "=" + cvalue + ";expires=" + expires + "; path=/");
	document.cookie = cookieString;
}


function getCookie(cname) {
	var name = cname + "=";
	var decodedCookie = decodeURIComponent(document.cookie);
	var ca = decodedCookie.split(';');
	for(var i = 0; i <ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return null;
}

function initLanguage(changelanguage) {
	// change language has first priority
	if (changelanguage != null) {
		selectedlanguage = changelanguage;
	}else{
		// language from cookies has second priority
		selectedlanguage = getCookie("language");
		if (selectedlanguage == null) {
			// default language has third priority
			selectedlanguage = "english";
		}
	}
	// keep cookie updated or create new cookie
	setCookie("language", selectedlanguage, 365);

	// select correct language button
	langbuttons = document.getElementsByClassName("langbutton");
	for (i = 0; i < langbuttons.length; i++) {
		if (langbuttons[i].getAttribute("id") === ("langbutton" + selectedlanguage)) {
			langbuttons[i].setAttribute("class", "langbutton selectedbutton");
		}else{
			langbuttons[i].setAttribute("class", "langbutton");			
		}
	}

	// section visibility
	var languages = ["german", "english"];
	for (language in languages) {
		var langdepsections = document.getElementsByClassName(languages[language]);
		for (i = 0; i < langdepsections.length; i++) {
			if (languages[language] === selectedlanguage) {
				langdepsections[i].style.display = "block";
			}else{
				langdepsections[i].style.display = "none";
			}
		}
	}
}

function setPageButton(pageId) {
	btn = document.getElementById("pagebutton" + pageId);
	if (btn) {
		btn.setAttribute("class", "pagebutton selectedbutton");
	}
}

function initPage(pageId) {
	includeExtHtml();
	initLanguage();
	setPageButton(pageId);
}