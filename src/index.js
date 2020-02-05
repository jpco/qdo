'use strict';

firebase.initializeApp({
    apiKey: 'AIzaSyDszUxv08D7ypv15AfgipQ36sWbkjQUglc',
    authDomain: 'jpco-qtodo.firebaseapp.com',
    projectId: 'jpco-qtodo'
});

window.addEventListener('load', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            window.location.replace('~');
        } else {
            document.getElementById('content').style.visibility = 'visible';
        }
    });
});
