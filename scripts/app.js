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
	// get all cookies in order not to lose their values
	newCookieString = "";
	var decodedCookieies = decodeURIComponent(document.cookie);
	var ca = decodedCookieies.split(';');
	for(var i = 0; i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c == "") continue;
		// keep other cookies unchanged
		if (c.indexOf(cname) != 0 && c.indexOf("expires") != 0 && c.indexOf("path") != 0) {
			newCookieString += c + ";"
		}
	}
	// overwrite with new value
	newCookieString += cname + "=" + cvalue + ";"

	// build new cookie string
	var d = new Date();
	d.setTime(d.getTime() + (exdays*24*60*60*1000));
	var expires = "expires="+ d.toUTCString();
	cookieString = encodeURIComponent(newCookieString + ";expires=" + expires + "; path=/");
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
	
	// copyright notice visibility
	var cookienotices = document.getElementsByClassName("cookienotice");
	for (i = 0; i < cookienotices.length; i++) {
		if (cookienotices[i].id == ("cookienotice_" + selectedlanguage)) {
			cookienotices[i].style.display = "block";
		}else{
			cookienotices[i].style.display = "none";			
		}
	}
}

function setPageButton(pageId) {
	btn = document.getElementById("pagebutton" + pageId);
	if (btn) {
		btn.setAttribute("class", "pagebutton selectedbutton");
	}
}

function acceptCookies() {
	setCookie("cookiesAccepted", true, 365);
	initCookieNotice();
}

function initCookieNotice() {
	if (getCookie("cookiesAccepted")) {
		document.getElementById("cookienotices").setAttribute("style", "visibility: hidden;");
	}
}

function initPage(pageId) {
	includeExtHtml();
	initLanguage();
	setPageButton(pageId);
	initCookieNotice();
}