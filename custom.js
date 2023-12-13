// create Agora client
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

var localTracks = {
    videoTrack: null,
    audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
    appid: null,
    channel: null,
    uid: null,
    token: null
};

// the demo can auto join channel with params in url
window.addEventListener("DOMContentLoaded", function() {
    var urlParams = new URL(location.href).searchParams;
    options.appid = urlParams.get("appid");
    options.channel = urlParams.get("channel");
    options.token = urlParams.get("token");
    if (options.appid && options.channel) {
        document.querySelector("#appid").value = options.appid;
        document.querySelector("#token").value = options.token;
        document.querySelector("#channel").value = options.channel;
        document.querySelector("#join-form").dispatchEvent(new Event("submit"));
    }
});

document.querySelector("#join-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    document.querySelector("#join").setAttribute("disabled", true);
    try {
        options.appid = document.querySelector("#appid").value;
        options.token = document.querySelector("#token").value;
        options.channel = document.querySelector("#channel").value;
        await join();
        if (options.token) {
            document.querySelector("#success-alert-with-token").style.display = "block";
        } else {
            document.querySelector("#success-alert a").setAttribute("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
            document.querySelector("#success-alert").style.display = "block";
        }
    } catch (error) {
        console.error(error);
    } finally {
        document.querySelector("#leave").removeAttribute("disabled");
    }
});

document.querySelector("#leave").addEventListener("click", function(e) {
    leave();
});

async function join() {
    // add event listener to play remote tracks when remote user publishes.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);

    // join a channel and create local tracks, we can use Promise.all to run them concurrently
    [options.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
        // join the channel
        client.join(options.appid, options.channel, options.token || null),
        // create local tracks, using microphone and camera
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack()
    ]);

    // play local video track
    localTracks.videoTrack.play("local-player");
    document.querySelector("#local-player-name").textContent = `localVideo(${options.uid})`;

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");
}

async function leave() {
    for (var trackName in localTracks) {
        var track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = undefined;
        }
    }

    // remove remote users and player views
    remoteUsers = {};
    document.querySelector("#remote-playerlist").innerHTML = "";

    // leave the channel
    await client.leave();

    document.querySelector("#local-player-name").textContent = "";
    document.querySelector("#join").removeAttribute("disabled");
    document.querySelector("#leave").setAttribute("disabled", true);
    console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
    const uid = user.uid;
    // subscribe to a remote user
    await client.subscribe(user, mediaType);
    console.log("subscribe success");
    if (mediaType === 'video') {
        const player = document.createElement("div");
        player.id = `player-wrapper-${uid}`;
        player.innerHTML = `
      <p class="player-name">remoteUser(${uid})</p>
      <div id="player-${uid}" class="player"></div>
    `;
        document.querySelector("#remote-playerlist").appendChild(player);
        user.videoTrack.play(`player-${uid}`);
    }
    if (mediaType === 'audio') {
        user.audioTrack.play();
    }
}

function handleUserPublished(user, mediaType) {
    const id = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
    const id = user.uid;
    delete remoteUsers[id];
    document.querySelector(`#player-wrapper-${id}`).remove();
}