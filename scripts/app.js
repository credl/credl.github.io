function getParameterByName(name, url) {
	if (!url) url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
	results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
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
						
function applyLanguage(selectedlanguage) {
	//var selectedlanguage = getParameterByName('lang');
	setCookie("language", selectedlanguage, 365);
	if (selectedlanguage == null) { selectedlanguage = "english"; }

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

function initLanguage() {
	lang = getCookie("language");
	if (lang == null) {
		lang = "english"; // default language
		setCookie("language", lang, 365);
	}
	applyLanguage(lang);
}

function includeHTML() {
		/*
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
			xhttp.open("GET", file, false);
			xhttp.send();
		}
	}
		*/
}
