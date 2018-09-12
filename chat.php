<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
		<link rel="stylesheet" href="https://code.getmdl.io/1.1.3/material.deep_purple-pink.min.css">
		<link href='https://fonts.googleapis.com/css?family=Roboto:400,500,700' rel='stylesheet' type='text/css'>
	  	<link rel="stylesheet" href="css/chatStyle.css">
	<title>Sonar Messaging</title>
</head>
<body>
	<!--
	<div id="overlay">
			<div>
					<h1>Connecting...</h1>
					<div id="p2" class="mdl-progress mdl-js-progress mdl-progress__indeterminate"></div>
			</div>
	</div>
	-->
	<!-- Always shows a header, even in smaller screens. -->
	<div class="mdl-layout mdl-js-layout mdl-layout--fixed-header has-drawer mdl-layout--fixed-drawer">
		<header class="mdl-layout__header">
				<div class="mdl-layout__header-row" >
						<!-- Title -->
						<span class="mdl-layout-title ">Sonar</span>

				</div>
		</header>
		<div class="mdl-layout__drawer">
				<span class="mdl-layout-title">Title</span>
		</div>
		<main class="mdl-layout__content">
				<div class="room-messages">
					
					<div class="messageBox sent">
						<p class="sender">Steven:</p>
					<div class="messageText message sent">
						Hello There!
					</div>
						<div class="messageTime messageText">14:57</div>
					</div>
					
					<div class="messageBox received">
						<p class="sender">Ryan:</p>
					<div class="messageText message received">
						yo yo yo!
					</div>
						<div class="messageTime messageText">15:03</div>
					</div>
					
					<div class="messageBox sent">
						<p class="sender">Steven:</p>
					<div class="messageText message sent">GOOD BYE!</div>
						<div class="messageTime messageText">15:04</div>
					</div>
					
						<div id="console"></div>
				</div>
				<div class="response">
						
						<ul>
								<li>
										<div class="mdl-textfield mdl-js-textfield">
												<textarea id="msg" class="mdl-textfield__input fullWidth" rows="1"></textarea>
							<label class="mdl-textfield__label" for="sample5">Type your message...</label>
										</div>  
								</li>
								
								<li>
										<button type="button" onClick="sendMessage()" id="send" class="mdl-button mdl-button--colored mdl-js-button mdl-button--raised mdl-js-ripple-effect">
								SEND
						</button>
								</li>
								
						</ul>
		
		
		<!--
		<textarea id="msg" class="" placeholder="Type your message here..."></textarea>
		-->
		
		<!-- Raised button with ripple -->
		
				</div>
		</main>
	</div>    
</body>

<footer>
	<script defer src="https://code.getmdl.io/1.1.3/material.min.js"></script>
	<script src="https://code.jquery.com/jquery-3.1.0.min.js" integrity="sha256-cCueBR6CsyA4/9szpPfrX3s49M9vUU5BgtiJj06wt/s=" crossorigin="anonymous"></script>
	<!--
	<script type="text/javascript" src="socketio.js"></script>
    -->
	<script>
        /* global $, io 
        var userDetails = null;
        var currentRoom = null;
    
        var socket = io.connect('http://clan-game-zuc0001.c9users.io:8081');
        
        setInterval(function() {
            if(socket.connected == false && socket.disconnected == true) {
                $("#overlay").addClass("show");
            }
            else {
                $("#overlay").removeClass("show");
            }
        },1000);
        
        function isConnected() {
            return (socket.connected && !socket.disconnected);
        }
        
        function hasWindowFocus() {
            return (document.hasFocus()) ? true : false;
        }
        
    // Setting up new client
		socket.on('connect', function() {
		    if(isConnected()) {
			    //output('System', 'Client has connected to the server!', '');
		    }
		});
		
		socket.on('updateUserDetails', function(data) {
			if(isConnected()) {
					userDetails = {
							id: data.id,
							fullname: data.fullname
					}
					checkHash();
			}
		});

			socket.on('sendMessage', function(data) {
			if(isConnected()) {
				output(data.userName, data.message, data.userId);
			}
		});
    
			function sendMessage() {
				if(isConnected()) {
					var message = $('#msg').val();
					$('#msg').val('');
					var toSend = {
							userId: userDetails.id,
							message: message,
							roomId: currentRoom
					}
					
					socket.emit('sendMessage', toSend);
				}
    	}
    	
    	function output(userName, message, id) {
    	    if(hasWindowFocus() == false) {
    	        document.title = "(1) - "+userName;
    	        var audio = new Audio('resources/blep.mp3');
                audio.play();
    	    }
    	    else {
    	        document.title = "havne't got this far yet";
    	    }
    	    
    	    var sentOrReceieved = "";
    	    
    	    if(id == userDetails.id)
    	    {
    	        sentOrReceieved = "sent";
    	        color = "mdl-color--primary";
    	    }
    	    else
    	    {
    	        sentOrReceieved = "received";
    	        color = "";
    			
    	    }
    	    
    	    var element = $("<div class=\"messageBox "+sentOrReceieved+"\">"
            	+	"<p class=\"sender\">"
            	+		userName +":"
            	+	"</p>"
            	+	"<div class=\"message  "+sentOrReceieved+" "+color+" messageText\">"
            	+		message
            	+	"</div>"
            	+"</div>");
    	    
    	    $('.room-messages').append(element);
    			
            var height = $('.room-messages')[0].scrollHeight;
            $('.room-messages').scrollTop(height);
            
		}
		
        $("#msg").keydown(function(e){
            if(e.keyCode == 13 && !e.shiftKey) {
                $('#send').click();
            }
            else if(e.keyCode == 13 && e.shiftKey) {
                var rows = parseInt($("#msg").attr("rows"));
                if(rows < 5) {
                    rows++;
                }
                $("#msg").attr("rows", rows);
                
                var responseHeight = $(".response").height();
                $('.room-messages').css('bottom', responseHeight);
            }
        });
        
        
        
        
        // Opening Rooms
        function checkHash() {
            if(window.location.hash && isConnected()) {
                var goToRoom = window.location.hash.substring(1);
                var sendData = {
                    roomId: goToRoom,
                    userId: userDetails.id
                }
                
                socket.emit('openRoom', sendData);
            }
        }
        window.onhashchange = checkHash;

        socket.on('openRoom', function(data) {
            if(isConnected()) {
                $('.room-messages').text('');
                currentRoom = data.roomID;
                
                for(var i = data.messages.length - 1; i >= 0; i--) {
                    output(data.messages[i][0], data.messages[i][1], data.messages[i][3]);
                }
            }
        });
		*/
    </script>
</footer>
</html>