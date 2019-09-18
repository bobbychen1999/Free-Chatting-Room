// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	
	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
		
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.emit('test',{message:"test"});



var users = [];
var rooms = {};
var lobby = {
	name: "lobby",
	people: [],
	pwd: "",
	owner: "",
	ban: []
}
rooms["lobby"] = lobby;

io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.
	//io.sockets.emit('test',{message:"test"});
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		var room = data["room"];
		console.log("message: "+data["message"]); // log it to the Node.JS output
		
				io.sockets.emit("message_to_client",{message:data["user"] + ": " + data["message"], room:room}) // broadcast the message to other users
			
		});
	
	//This callback runs when there is a ban request from the client
	socket.on("ban_request", function(data){
		console.log(data["user"]);
		var i = 0;
		while (i < rooms[data["room"]]["people"].length) {
			var user = rooms[data["room"]]["people"][i];
			if (user == data["user"]) {
				rooms[data["room"]]["people"].splice(i,1);
				//broadcast the new room back to the client
				io.sockets.emit("ban/kick_response", {message: "you have kicked the user out of this room", to: rooms[data["room"]]["owner"]});
			io.sockets.emit("banned/kicked", {message: "you have been kicked out of " + data["room"], to: data["user"]});
				return;
			}
			i++;
		}
		console.log(data["user"] + " is not in this room");
		
		io.sockets.emit("ban/kick_response", {message: data["user"] + " is not in this room", to: rooms[data["room"]]["owner"]});
	});

		//This callback runs when there is a kick request from the client

	socket.on("kick_request", function(data){
		var r = data["room"];
		var i = 0;
		while (i < rooms[r]["people"].length) {
			var user = rooms[r]["people"][i];
			if (user == data["user"]) {
				rooms[r]["people"].splice(i,1);
				rooms[r]["ban"].push(user);
				io.sockets.emit("ban/kick_response", {message: "you have banned the user out of this room", to: rooms[r]["owner"]});
				io.sockets.emit("banned/kicked", {message: "you have been banned out of " + r, to: data["user"]});
				console.log(rooms[r]["ban"]);
				return;
			}
			i++;
		}
		io.sockets.emit("ban/kick_response", {message: data["user"] + " is not in this room", to: rooms[r]["owner"]});
	});
		//This callback runs when there is a user is trying to go back to the lobby
	socket.on("lobby_request", function(data){
		console.log("lobby_request");
		var room = data["room"];
		var user = data["name"];
		for (r in rooms) {
			if (r == room) {
				var i = 0;
				while (i < rooms[r]["people"].length) {
					if (user == rooms[r]["people"][i]) {
						rooms[r]["people"].splice(i, 1);
						console.log(user + " has left room: " + room);
						console.log("people in this room: " + rooms[room]["people"]);
						return;
					}
					i++;
				}
				return;
			}
		}
		console.log("no room of this name?")
	});
		//This callback runs when there is a create room request from the client

	socket.on("create_request", function(data){
		var u = data["from"];
		var room_name = data["room_name"];
		var pwd = data["pwd"];
		for (sroom in rooms) {
			var temp = sroom;
			if (temp == room_name) {
				io.sockets.emit("create_response", {message: "a room of this name already exists", to: u});
				console.log("repeated rm name");
				return;
			}
		}
		var temp = {
			name: room_name,
			people: [],
			pwd: pwd,
			owner: u,
			ban: []
		}
		temp["people"].push(u);
		rooms[room_name] = temp;
		io.sockets.emit("create_response", {message: "room created", to: u, rm: room_name});
		console.log(u + " has created a room with name: " + room_name + " and pwd: " + pwd);
		console.log(u + " has joined room: " + room_name);
		console.log("people in this room: " + rooms[room_name]["people"]);
	});

		//This callback runs when we try to delete a person from the banned list

	socket.on("unban_request", function(data){
		var r = data["room"];
		var i = 0;
		var count = 0;
		while (i < rooms[r]["ban"].length) {
		 var user = rooms[r]["ban"][i];
		 if (user == data["user"]) {
		  rooms[r]["ban"].splice(i,1);
		  console.log(rooms[r]["ban"]);
		  count++;
		 }
		 i++;
		}
		if (count == 0) io.sockets.emit("unban_response", {message: data["user"] + " is not in this room's ban_list", to: rooms[r]["owner"]});
		else io.sockets.emit("unban_response", {message: "you have unbanned the user out of this room", to: rooms[r]["owner"]});
	   });

	   	//This callback runs when a private message is sent

	socket.on("pm_server", function(data){
		var sender = data["sender"];
		var receiver = data["receiver"];
		var message = data["message"];
		var i = 0;
			while (i < rooms[data["room"]]["people"].length ){
				a = rooms[data["room"]]["people"][i];
			if(receiver == a){
				// check if the receiver and sender are in the same room
				console.log(message);
				io.sockets.emit('private_message', {receiver: receiver, message: message, sender: sender});
			return;
			}
			i++;
			}
			io.sockets.emit("private_message",{receiver:sender,message:"no person of this name in this room"});
		

	});
		//This callback runs when we want to see who are in the current room

	socket.on("see_request", function(data){
		io.sockets.emit("see_response",{receiver:data["from"], list: rooms[data["room"]]["people"]});
	})
		//This callback runs when there is a join room request from the client

	socket.on("join_request", function(data){
		var rmName = data["room_name"];
		var pwd = data["pwd"];
		for (sroom in rooms) {
			if (sroom == rmName && rooms[sroom]["pwd"] == pwd) {
				var u = data["from"];
				console.log(u);
				console.log(sroom + " ban list: " + rooms[sroom]["ban"]);
				var i = 0;
				while (i < rooms[sroom]["ban"].length) {
					var banned = rooms[sroom]["ban"][i];
					if (banned == u) {
						// check if the user is banned or not
						console.log("a banned motherfucker wants to enter this room but we made his mother exploded");
						io.sockets.emit("join_response", {message:"you are banned from joining this room", to: u});
						return;
					}
					i++;
				}
				io.sockets.emit("join_response", {message:"success",to:data["from"], new_room:rmName, users_list:rooms[sroom]["people"],owner:rooms[sroom]["owner"]});
				rooms[sroom]["people"].push(data["from"]);
				console.log(u + " has joined room: ");
				console.log("people in this room: " + rooms[sroom]["people"]);
				return;
			}
			else if (sroom == rmName) {
				io.sockets.emit("join_response", {message:"wrong password",to:data["from"]});
				return;
			}
		}
		io.sockets.emit("join_response", {message:"no room of this name exists",to:data["from"]});
		//io.sockets.emit("users_display", {user:socket.user});
		
	});
});
	io.sockets.emit('test',{message:"test"});





