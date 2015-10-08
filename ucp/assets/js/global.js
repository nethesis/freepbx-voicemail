var VoicemailC = UCPMC.extend({
	init: function() {
		this.loaded = null;
		this.recording = false;
		this.recorder = null;
		this.recordTimer = null;
		this.startTime = null;
		this.soundBlobs = {};
		this.placeholders = [];
	},
	getInfo: function() {
		return { name: _("Voicemail") };
	},
	settingsDisplay: function() {
		var $this = this;
		$("#ddial, #vmx-p1_enable").change(function() {
			$this.findmeFollowState();
		});
		this.findmeFollowState();
		$("#module-Voicemail form .input-group").each(function( index ) {
			$(this).find("input[type=\"text\"]").prop("disabled", !$(this).find("input[type=\"checkbox\"]").is(":checked"));
		});
		$("#module-Voicemail input[type=\"text\"]").change(function() {
			$(this).blur(function() {
				$this.saveVmXSettings($(this).prop("name"), $(this).val());
				$(this).off("blur");
			});
		});
		$("#module-Voicemail .input-group input[type=\"checkbox\"]").change(function() {
			var el = $(this).data("el");
			if (!$(this).is(":checked")) {
				$("#" + el).prop("disabled", true);
				$("#" + el).prop("placeholder", $("#" + el).data("ph"));
				if ($("#" + el).val() !== "") {
					$("#" + el).val("");
					$this.saveVmXSettings($("#" + el).prop("name"), "");
				}
			} else {
				$("#" + el).prop("placeholder", "");
				$("#" + el).prop("disabled", false);
			}
		});

		$("#module-Voicemail .dests input[type=\"checkbox\"]").change(function() {
			$this.saveVmXSettings($(this).prop("name"), $(this).is(":checked"));
		});
	},
	settingsHide: function() {
		$("#module-Voicemail input[type=\"text\"], #module-Findmefollow textarea").off("change");
		$("#module-Voicemail input[type=\"checkbox\"]").off("change");
		$("#ddial, #vmx-p1_enable").off("change");
	},
	findmeFollowState: function() {
		if (!$("#vmx-p1_enable").is(":checked") && !$("#ddial").is(":checked")) {
			$("#vmxerror").text(_("Find me Follow me is disabled when VmX locator option 1 is disabled as well!")).addClass("alert-danger").fadeIn("fast");
		} else {
			$("#vmxerror").fadeOut("fast");
		}
	},
	saveVmXSettings: function(key, value) {
		var data = { ext: ext, settings: { key: key, value: value } };
		$.post( "index.php?quietmode=1&module=voicemail&command=vmxsettings", data, function( data ) {
			if (data.status) {
				$("#vmxmessage").text(data.message).addClass("alert-" + data.alert).fadeIn("fast", function() {
					$(this).delay(5000).fadeOut("fast", function() {
						$(".masonry-container").packery();
					});
				});
				$(".masonry-container").packery();
			} else {
				return false;
			}
		});
	},
	poll: function(data) {
		if (data.status) {
			var notify = 0,
			voicemailNotification = {};
			if ($("#voicemail-badge").html() < data.total) {
				notify = data.total - $("#voicemail-badge").html();
			}
			$.each( data.boxes, function( extension, messages ) {
				if ($("#voicemail-" + extension + "-badge").html() < messages) {
					notify = (messages - $("#voicemail-badge").html()) + notify;
				}
			});
			voicemailNotification = new Notify("Voicemail", {
				body: sprintf(_("You Have %s New Voicemail"), notify),
				icon: "modules/Voicemail/assets/images/mail.png"
			});
			if (notify > 0) {
				if (UCP.notify) {
					voicemailNotification.show();
				}
				this.refreshFolderCount();
				$('#voicemail-grid').bootstrapTable('refresh');
			}
		}
	},
	display: function(event) {
		var $this = this;
		$this.init();
		//If browser doesnt support get user media requests then just hide it from the display
		if (!Modernizr.getusermedia) {
			$(".jp-record-wrapper").hide();
			$(".record-greeting-btn").hide();
		} else {
			$(".jp-record-wrapper").show();
			$(".jp-stop-wrapper").hide();
			$(".record-greeting-btn").show();
		}

		if($.url().param("view") == "greetings") {
			$this.bindPlayers(Modernizr.getusermedia);
		}

		$('#voicemail-grid').on("post-body.bs.table", function () {
			$this.bindPlayers();
			$("#voicemail-grid a.listen").click(function() {
				var id = $(this).data("id"), select = null;
				$.each(mailboxes, function(i,v) {
					select = select + "<option value='"+v+"'>"+v+"</option>";
				});
				UCP.showDialog(_("Listen to Voicemail"),
					_("On") + ":</label><select class=\"form-control\" id=\"VMto\">"+select+"</select><button class=\"btn btn-default\" id=\"listenVM\" style=\"margin-left: 72px;\">" + _("Listen") + "</button>",
					145,
					250,
					function() {
						$("#listenVM").click(function() {
							var recpt = $("#VMto").val();
							$this.listenVoicemail(id,recpt);
						});
						$("#VMto").keypress(function(event) {
							if (event.keyCode == 13) {
								var recpt = $("#VMto").val();
								$this.listenVoicemail(id,recpt);
							}
						});
					}
				);
			});
			$("#voicemail-grid a.forward").click(function() {
				var id = $(this).data("id");
				UCP.showDialog(_("Forward Voicemail"),
					_("To")+":</label><select class=\"form-control Fill\" id=\"VMto\"></select><button class=\"btn btn-default\" id=\"forwardVM\" style=\"margin-left: 72px;\">" + _("Forward") + "</button>",
					145,
					250,
					function() {
						$("#VMto").tokenize({
							newElements: false,
							maxElements: 1,
							datas: "index.php?quietmode=1&module=voicemail&command=forwards&ext="+extension
						});
						$("#forwardVM").click(function() {
							setTimeout(function() {
								var recpt = $("#VMto").val()[0];
								$this.forwardVoicemail(id,recpt);
							}, 50);
						});
						$("#VMto").keypress(function(event) {
							if (event.keyCode == 13) {
								setTimeout(function() {
									var recpt = $("#VMto").val()[0];
									$this.forwardVoicemail(id,recpt);
								}, 50);
							}
						});
					}
				);
			});
			$("#voicemail-grid a.delete").click(function() {
				var id = $(this).data("id");
				if (confirm(_("Are you sure you wish to delete this voicemail?"))) {
					$this.deleteVoicemail(id);
				}
			});
		});
		$('#voicemail-grid').on("check.bs.table uncheck.bs.table", function () {
			var sel = $(this).bootstrapTable('getAllSelections'),
					dis = true;
			if(sel.length) {
				dis = false;
			}
			$("#delete-selection").prop("disabled",dis);
			$("#forward-selection").prop("disabled",dis);
			$("#move-selection").prop("disabled",dis);
		});

		$("#move-selection").click(function() {
			var opts = '', cur = $.url().param("folder"), sel = $('#voicemail-grid').bootstrapTable('getAllSelections');
			$.each($(".folder-list .folder"), function(i, v){
				var folder = $(v).data("folder");
				if(folder != cur) {
					opts += '<option>'+$(v).data("name")+'</option>';
				}
			});
			UCP.showDialog(_("Move Voicemail"),
				_("To")+":</label><select class=\"form-control\" id=\"VMmove\">"+opts+"</select><button class=\"btn btn-default\" id=\"moveVM\" style=\"margin-left: 72px;\">" + _("Move") + "</button>",
				145,
				250,
				function() {
					var total = sel.length, processed = 0;
					$("#moveVM").click(function() {
						$.each(sel, function(i, v){
							$this.moveVoicemail(v.msg_id, $("#VMmove").val(), extension, function(data) {
								if(data.status) {
									$('#voicemail-grid').bootstrapTable('hideRow', {index: v.msg_id, isIdField: true});
								}
								processed++;
								if(processed == total) {
									UCP.closeDialog();
								}
							});
						});
					});
					$("#VMmove").keypress(function(event) {
						if (event.keyCode == 13) {
							$.each(sel, function(i, v){
								$this.moveVoicemail(v.msg_id, $("#VMmove").val(), extension, function(data) {
									if(data.status) {
										$('#voicemail-grid').bootstrapTable('hideRow', {index: v.msg_id, isIdField: true});
									}
									processed++;
									if(processed == total) {
										UCP.closeDialog();
									}
								});
							});
						}
					});
				}
			);
		});
		$("#delete-selection").click(function() {
			if (confirm(_("Are you sure you wish to delete this voicemail?"))) {
				var sel = $('#voicemail-grid').bootstrapTable('getAllSelections');
				$.each(sel, function(i, v){
					$this.deleteVoicemail(v.msg_id, function(data) {
						if(data.status) {
							$('#voicemail-grid').bootstrapTable('hideRow', {index: v.msg_id, isIdField: true});
						}
					});
				});
				$('#voicemail-grid').bootstrapTable('refresh');
				$("#delete-selection").prop("disabled",true);
			}
		});
		$("#forward-selection").click(function() {
			var sel = $('#voicemail-grid').bootstrapTable('getAllSelections');
			UCP.showDialog(_("Forward Voicemail"),
				_("To")+":</label><select class=\"form-control Fill\" id=\"VMto\"></select><button class=\"btn btn-default\" id=\"forwardVM\" style=\"margin-left: 72px;\">" + _("Forward") + "</button>",
				145,
				250,
				function() {
					$("#VMto").tokenize({
						newElements: false,
						maxElements: 1,
						datas: "index.php?quietmode=1&module=voicemail&command=forwards&ext="+extension
					});
					$("#forwardVM").click(function() {
						setTimeout(function() {
							var recpt = $("#VMto").val()[0];
							$.each(sel, function(i, v){
								$this.forwardVoicemail(v.msg_id,recpt);
							});
						}, 50);
					});
					$("#VMto").keypress(function(event) {
						if (event.keyCode == 13) {
							setTimeout(function() {
								var recpt = $("#VMto").val()[0];
								$.each(sel, function(i, v){
									$this.forwardVoicemail(v.msg_id,recpt);
								});
							}, 50);
						}
					});
				}
			);
			$('#voicemail-grid').bootstrapTable('uncheckAll');
		});


		$(".clickable").click(function(e) {
			var text = $(this).text();
			if (UCP.validMethod("Contactmanager", "showActionDialog")) {
				UCP.Modules.Contactmanager.showActionDialog("number", text, "phone");
			}
		});
		$(".recording-controls .save").click(function() {
			var id = $(this).data("id");
			$this.saveRecording(id);
		});
		$(".recording-controls .delete").click(function() {
			var id = $(this).data("id");
			$this.deleteRecording(id);
		});
		$(".file-controls .record, .jp-record").click(function() {
			var id = $(this).data("id");
			$this.recordGreeting(id);
		});
		$(".file-controls .delete").click(function() {
			var id = $(this).data("id");
			$this.deleteGreeting(id);
		});
		//Nothing on this page will really work without drag and drop at this point
		if (true) {
			/* MailBox Binds */
			$this.enableDrags();

			//Bind to the mailbox folders, listen for a drop
			$(".mailbox .folder-list .folder").on("drop", function(event) {
				if (event.stopPropagation) {
					event.stopPropagation(); // Stops some browsers from redirecting.
				}
				if (event.preventDefault) {
					event.preventDefault(); // Necessary. Allows us to drop.
				}
				var msg = event.originalEvent.dataTransfer.getData("msg"),
				folder = $(event.currentTarget).data("folder"),
				data = { msg:msg, folder:folder, ext:extension };
				$.post( "index.php?quietmode=1&module=voicemail&command=moveToFolder", data, function( data ) {
					if (data.status) {
						$(this).removeClass("hover");
						var dragSrc = $(".message-list #voicemail-grid[data-msg=\"" + msg + "\"]"),
						badge = null;
						dragSrc.remove();
						$(".vm-temp").remove();
						badge = $(event.currentTarget).find(".badge");
						badge.text(Number(badge.text()) + 1);

						badge = $(".mailbox .folder-list .folder.active").find(".badge");
						badge.text(Number(badge.text()) - 1);
						$("#freepbx_player_" + msg).jPlayer("pause");
						$("#vm_playback_" + msg).remove();
					} else {
						//nothing
					}
				});
			});

			//Mailbox drag over event
			$(".mailbox .folder-list .folder").on("dragover", function(event) {
				if (event.preventDefault) {
					event.preventDefault(); // Necessary. Allows us to drop.
				}
				//Just do a hover image
				$(this).addClass("hover");
			});

			//Mailbox drag enter, entering a drag event
			$(".mailbox .folder-list .folder").on("dragenter", function(event) {
				//Add hover class
				$(this).addClass("hover");
			});

			//Mailbox drag leave, leaving a drag element
			$(".mailbox .folder-list .folder").on("dragleave", function(event) {
				//remove hover class
				$(this).removeClass("hover");
			});
			/** END MAILBOX BINDS **/

			/** START GREETING BINDS **/
			//Bind to drag start for the html5 audio element
			$(".greeting-control .jp-audio").on("dragstart", function(event) {
				event.originalEvent.dataTransfer.effectAllowed = "move";
				event.originalEvent.dataTransfer.setData("type", $(this).data("type"));
				$(this).fadeTo( "fast", 0.5);
			});
			$(".greeting-control .jp-audio").on("dragend", function(event) {
				$(this).fadeTo( "fast", 1.0);
			});

			//Bind to the file drop, we are already bound from the jquery file handler
			//but we bind again to pick up "copy" events, to which file drop will ignore
			$(".filedrop").on("drop", function(event) {
				//Make sure there are no files coming from the desktop
				if (event.originalEvent.dataTransfer.files.length === 0) {
					if (event.stopPropagation) {
						event.stopPropagation(); // Stops some browsers from redirecting.
					}
					if (event.preventDefault) {
						event.preventDefault(); // Necessary. Allows us to drop.
					}
					//remove the hover event
					$(this).removeClass("hover");

					//get our type
					var target = $(this).data("type"),
					//ger the incoming type
					source = event.originalEvent.dataTransfer.getData("type");
					//dont allow other things to be dragged to this, just ignore them
					if (source === "") {
						alert(_("Not a valid Draggable Object"));
						return false;
					}
					//prevent dragging onto self, useless copying
					if (source == target) {
						alert(_("Dragging to yourself is not allowed"));
						return false;
					}

					//Send copy ajax
					var data = { ext: extension, source: source, target: target },
					message = $(this).find(".message");
					message.text(_("Copying..."));
					$.post( "index.php?quietmode=1&module=voicemail&command=copy", data, function( data ) {
						if (data.status) {
							$("#freepbx_player_" + target).jPlayer( "setMedia", {
								wav: "?quietmode=1&module=voicemail&command=listen&msgid=" + target + "&format=wav&ext=" + extension,
								oga: "?quietmode=1&module=voicemail&command=listen&msgid=" + target + "&format=oga&ext=" + extension
							});
							message.text(_("Drag a New Greeting Here"));
							$this.toggleGreeting(target, true);
						} else {
							return false;
						}
					});
				}
			});

			$(".filedrop").on("dragover", function(event) {
				if (event.preventDefault) {
					event.preventDefault(); // Necessary. Allows us to drop.
				}
				$(this).addClass("hover");
			});
			$(".filedrop").on("dragleave", function(event) {
				$(this).removeClass("hover");
			});
			/** END GREETING BINDS **/
		} else {
			// Fallback to a library solution?
			//alert(_("You have No Drag/Drop Support!"));

		}
		//clear old binds
		$(document).off("click", "[vm-pjax] a, a[vm-pjax]");
		//then rebind!
		if ($.support.pjax) {
			$(document).on("click", "[vm-pjax] a, a[vm-pjax]", function(event) {
				var container = $("#dashboard-content");
				$.pjax.click(event, { container: container });
				$this.enableDrags();
			});
		}

		/* END MESSAGE PLAYER BINDS */

		/* GREETING PLAYER BINDS */
		$("#unavail input[type=\"file\"]").fileupload({
			url: "?quietmode=1&module=voicemail&command=upload&type=unavail&ext=" + extension,
			dropZone: $("#unavail .filedrop"),
			dataType: "json",
			add: function(e, data) {
				$("#unavail .filedrop .message").text(_("Uploading..."));
				data.submit();
			},
			done: function(e, data) {
				if (data.result.status) {
					$("#unavail .filedrop .pbar").css("width", "0%");
					$("#unavail .filedrop .message").text(_("Drag a New Greeting Here"));
					$("#freepbx_player_unavail").jPlayer( "setMedia", {
						wav: "?quietmode=1&module=voicemail&command=listen&msgid=unavail&format=wav&ext=" + extension + "&rand=" + $this.generateRandom(),
						oga: "?quietmode=1&module=voicemail&command=listen&msgid=unavail&format=oga&ext=" + extension + "&rand=" + $this.generateRandom()
					});
					$this.toggleGreeting("unavail", true);
				} else {
					console.log(data.result.message);
				}
			},
			progressall: function(e, data) {
				var progress = parseInt(data.loaded / data.total * 100, 10);
				$("#unavail .filedrop .pbar").css("width", progress + "%");
			},
			drop: function(e, data) {
				$("#unavail .filedrop").removeClass("hover");
			}
		});
		$("#busy input[type=\"file\"]").fileupload({
			url: "?quietmode=1&module=voicemail&command=upload&type=busy&ext=" + extension,
			dropZone: $("#busy .filedrop"),
			dataType: "json",
			add: function(e, data) {
				$("#busy .filedrop .message").text(_("Uploading..."));
				data.submit();
			},
			done: function(e, data) {
				if (data.result.status) {
					$("#busy .filedrop .pbar").css("width", "0%");
					$("#busy .filedrop .message").text(_("Drag a New Greeting Here"));
					$("#freepbx_player_busy").jPlayer( "setMedia", {
						wav: "?quietmode=1&module=voicemail&command=listen&msgid=busy&format=wav&ext=" + extension + "&rand=" + $this.generateRandom(),
						oga: "?quietmode=1&module=voicemail&command=listen&msgid=busy&format=oga&ext=" + extension + "&rand=" + $this.generateRandom()
					});
					$this.toggleGreeting("busy", true);
				} else {
					console.log(data.result.message);
				}
			},
			progressall: function(e, data) {
				var progress = parseInt(data.loaded / data.total * 100, 10);
				$("#busy .filedrop .pbar").css("width", progress + "%");
			},
			drop: function(e, data) {
				$("#busy .filedrop").removeClass("hover");
			}
		});
		$("#greet input[type=\"file\"]").fileupload({
			url: "?quietmode=1&module=voicemail&command=upload&type=greet&ext=" + extension,
			dropZone: $("#greet .filedrop"),
			dataType: "json",
			add: function(e, data) {
				$("#greet .filedrop .message").text(_("Uploading..."));
				data.submit();
			},
			done: function(e, data) {
				if (data.result.status) {
					$("#greet .filedrop .pbar").css("width", "0%");
					$("#greet .filedrop .message").text(_("Drag a New Greeting Here"));
					$("#freepbx_player_greet").jPlayer( "setMedia", {
						wav: "?quietmode=1&module=voicemail&command=listen&msgid=greet&format=wav&ext=" + extension + "&rand=" + $this.generateRandom(),
						oga: "?quietmode=1&module=voicemail&command=listen&msgid=greet&format=oga&ext=" + extension + "&rand=" + $this.generateRandom()
					});
					$this.toggleGreeting("greet", true);
				} else {
					console.log(data.result.message);
				}
			},
			progressall: function(e, data) {
				var progress = parseInt(data.loaded / data.total * 100, 10);
				$("#greet .filedrop .pbar").css("width", progress + "%");
			},
			drop: function(e, data) {
				$.each(data.files, function(index, file) {
					//alert('Dropped file: ' + file.name);
				});
				$("#greet .filedrop").removeClass("hover");
				$("#greet .filedrop .message").text(_("Uploading..."));
			}
		});

		$("#temp input[type=\"file\"]").fileupload({
			url: "?quietmode=1&module=voicemail&command=upload&type=temp&ext=" + extension,
			dropZone: $("#temp .filedrop"),
			dataType: "json",
			add: function(e, data) {
				$("#temp .filedrop .message").text(_("Uploading..."));
				data.submit();
			},
			done: function(e, data) {
				if (data.result.status) {
					$("#temp .filedrop .pbar").css("width", "0%");
					$("#temp .filedrop .message").text(_("Drag a New Greeting Here"));
					$("#freepbx_player_temp").jPlayer( "setMedia", {
						wav: "?quietmode=1&module=voicemail&command=listen&msgid=temp&format=wav&ext=" + extension + "&rand=" + $this.generateRandom(),
						oga: "?quietmode=1&module=voicemail&command=listen&msgid=temp&format=oga&ext=" + extension + "&rand=" + $this.generateRandom()
					});
					$this.toggleGreeting("temp", true);
				} else {
					console.log(data.result.message);
				}
			},
			progressall: function(e, data) {
				var progress = parseInt(data.loaded / data.total * 100, 10);
				$("#temp .filedrop .pbar").css("width", progress + "%");
			},
			drop: function(e, data) {
				$("#temp .filedrop").removeClass("hover");
			}
		});
		/* END GREETING PLAYER BINDS */

		/* Settings changes binds */
		$(".vmsettings input[type!=\"checkbox\"]").change(function() {
			$(this).blur(function() {
				$this.saveVMSettings();
				$(this).off("blur");
			});
		});
		$(".vmsettings input[type=\"checkbox\"]").change(function() {
			$this.saveVMSettings();
		});
		/* end settings changes binds */
	},
	hide: function(event) {
		$("#voicemail-grid a.play").off("click");
		$("#voicemail-grid a.delete").off("click");
	},
	//Delete a voicemail greeting
	deleteGreeting: function(type) {
		var $this = this, data = { msg: type, ext: extension };
		$.post( "index.php?quietmode=1&module=voicemail&command=delete", data, function( data ) {
			if (data.status) {
				$this.toggleGreeting(type, false);
				$("#freepbx_player_" + type).jPlayer( "clearMedia" );
			} else {
				return false;
			}
		});
	},
	refreshFolderCount: function() {
		var data = {
			ext: extension
		};
		$.post( "index.php?quietmode=1&module=voicemail&command=refreshfoldercount", data, function( data ) {
			if(data.status) {
				$.each(data.folders, function(i,v) {
					$(".mailbox .folder-list .folder[data-name='"+v.folder+"'] .badge").text(v.count);
				});
			}
		});
	},
	moveVoicemail: function(msgid, folder, extension, callback) {
		var data = {
			msg: msgid,
			folder: folder,
			ext: extension
		},
		$this = this;
		$.post( "index.php?quietmode=1&module=voicemail&command=moveToFolder", data, function(data) {
			$this.refreshFolderCount();
			if(typeof callback === "function") {
				callback(data);
			}
		});
	},
	forwardVoicemail: function(msgid, recpt, callback) {
		var data = {
			id: msgid,
			to: recpt
		};
		$.post( "index.php?quietmode=1&module=voicemail&command=forward&ext="+extension, data, function(data) {
			if(typeof callback === "function") {
				callback(data);
			}
		});
	},
	//Used to delete a voicemail message
	deleteVoicemail: function(msgid, callback) {
		var data = {
			msg: msgid,
			ext: extension
		},
		$this = this;

		$.post( "index.php?quietmode=1&module=voicemail&command=delete", data, function( data ) {
			$this.refreshFolderCount();
			if(typeof callback === "function") {
				callback(data);
			}
		});
	},
	//Toggle the html5 player for greeting
	toggleGreeting: function(type, visible) {
		if (visible === true) {
			$("#" + type + " button").fadeIn();
			$("#freepbx_player_" + type + "_1").slideDown();
		} else {
			$("#" + type + " button").fadeOut();
			$("#freepbx_player_" + type + "_1").slideUp();
		}
	},
	//Save Voicemail Settings
	saveVMSettings: function() {
		$("#message").fadeOut("slow");
		var data = { ext: extension };
		$(".vmsettings input[type!=\"checkbox\"]").each(function( index ) {
			data[$( this ).attr("name")] = $( this ).val();
		});
		$(".vmsettings input[type=\"checkbox\"]").each(function( index ) {
			data[$( this ).attr("name")] = $( this ).is(":checked");
		});
		$.post( "?quietmode=1&module=voicemail&command=savesettings", data, function( data ) {
			if (data.status) {
				$("#message").addClass("alert-success");
				$("#message").text(_("Your settings have been saved"));
				$("#message").fadeIn( "slow", function() {
					setTimeout(function() { $("#message").fadeOut("slow"); }, 2000);
				});
			} else {
				$("#message").addClass("alert-error");
				$("#message").text(data.message);
				return false;
			}
		});
	},
	//Enables all draggable elements
	enableDrags: function() {
		$(".mailbox #voicemail-grid").on("drop", function(event) {
		});
		$(".mailbox #voicemail-grid").on("dragstart", function(event) {
			$(this).fadeTo( "fast", 0.5);
			event.originalEvent.dataTransfer.effectAllowed = "move";
			event.originalEvent.dataTransfer.setData("msg", $(this).data("msg"));
		});
		$(".mailbox #voicemail-grid").on("dragend", function(event) {
			$(".vm-temp").remove();
			$(this).fadeTo( "fast", 1.0);
		});
		$(".mailbox #voicemail-grid").on("dragenter", function(event) {
		});
	},
	recordGreeting: function(type) {
		var $this = this;
		if (!Modernizr.getusermedia) {
			alert(_("Direct Media Recording is Unsupported in your Broswer!"));
			return false;
		}
		counter = $("#jp_container_" + type + " .jp-current-time");
		title = $("#jp_container_" + type + " .title-text");
		filec = $("#" + type + " .file-controls");
		recc = $("#" + type + " .recording-controls");
		var controls = $("#jp_container_" + type + " .jp-controls");
		controls.toggleClass("recording");
		if ($this.recording) {
			clearInterval($this.recordTimer);
			title.text(_("Recorded Message"));
			$this.recorder.stop();
			$this.recorder.exportWAV(function(blob) {
				$this.soundBlobs[type] = blob;
				var url = (window.URL || window.webkitURL).createObjectURL(blob);
				$("#freepbx_player_" + type).jPlayer( "clearMedia" );
				$("#freepbx_player_" + type).jPlayer( "setMedia", {
					wav: url
				});
			});
			$this.recording = false;
			recc.show();
			filec.hide();
		} else {
			window.AudioContext = window.AudioContext || window.webkitAudioContext;

			var context = new AudioContext();

			var gUM = Modernizr.prefixed("getUserMedia", navigator);
			gUM({ audio: true }, function(stream) {
				var mediaStreamSource = context.createMediaStreamSource(stream);
				$this.recorder = new Recorder(mediaStreamSource,{ workerPath: "assets/js/recorderWorker.js" });
				$this.recorder.record();
				$this.startTime = new Date();
				$this.recordTimer = setInterval(function () {
					var mil = (new Date() - $this.startTime);
					var temp = (mil / 1000);
					var min = ("0" + Math.floor((temp %= 3600) / 60)).slice(-2);
					var sec = ("0" + Math.round(temp % 60)).slice(-2);
					counter.text(min + ":" + sec);
				}, 1000);
				title.text(_("Recording..."));
				$this.recording = true;
				$("#jp_container_" + type).removeClass("greet-hidden");
				recc.hide();
				filec.show();
			}, function(e) {
				alert(_("Your Browser Blocked The Recording, Please check your settings"));
				$this.recording = false;
			});
		}
	},
	saveRecording: function(type) {
		var $this = this,
				filec = $("#" + type + " .file-controls"),
				recc = $("#" + type + " .recording-controls");
				title = $("#" + type + " .title-text");
		if ($this.recording) {
			alert(_("Stop the Recording First before trying to save"));
			return false;
		}
		if ((typeof($this.soundBlobs[type]) !== "undefined") && $this.soundBlobs[type] !== null) {
			$("#" + type + " .filedrop .message").text(_("Uploading..."));
			var data = new FormData();
			data.append("file", $this.soundBlobs[type]);
			$.ajax({
				type: "POST",
				url: "index.php?quietmode=1&module=voicemail&command=record&type=" + type + "&ext=" + extension,
				xhr: function()
				{
					var xhr = new window.XMLHttpRequest();
					//Upload progress
					xhr.upload.addEventListener("progress", function(evt) {
						if (evt.lengthComputable) {
							var percentComplete = evt.loaded / evt.total,
							progress = Math.round(percentComplete * 100);
							$("#" + type + " .filedrop .pbar").css("width", progress + "%");
						}
					}, false);
					return xhr;
				},
				data: data,
				processData: false,
				contentType: false,
				success: function(data) {
					$("#" + type + " .filedrop .message").text("Drag a New Greeting Here");
					$("#" + type + " .filedrop .pbar").css("width", "0%");
					$this.soundBlobs[type] = null;
					$("#freepbx_player_" + type).jPlayer("supplied",supportedHTML5);
					$("#freepbx_player_" + type).jPlayer( "clearMedia" );
					title.text(title.data("title"));
					filec.show();
					recc.hide();
				},
				error: function() {
					//error
					filec.show();
					recc.hide();
				}
			});
		}
	},
	deleteRecording: function(type) {
		var $this = this,
				filec = $("#" + type + " .file-controls"),
				recc = $("#" + type + " .recording-controls");
		if ($this.recording) {
			alert(_("Stop the Recording First before trying to delete"));
			return false;
		}
		if ((typeof($this.soundBlobs[type]) !== "undefined") && $this.soundBlobs[type] !== null) {
			$this.soundBlobs[type] = null;
			$("#freepbx_player_" + type).jPlayer("supplied",supportedHTML5);
			$("#freepbx_player_" + type).jPlayer( "clearMedia" );
			title.text(title.data("title"));
			filec.show();
			recc.hide();
		} else {
			alert(_("There is nothing to delete"));
		}
	},
	//This function is here solely because firefox caches media downloads so we have to force it to not do that
	generateRandom: function() {
		return Math.round(new Date().getTime() / 1000);
	},
	dateFormatter: function(value, row, index) {
		return UCP.dateFormatter(value);
	},
	listenVoicemail: function(msgid, recpt) {
		var data = {
			id: msgid,
			to: recpt
		};
		$.post( "index.php?quietmode=1&module=voicemail&command=callme&ext="+extension, data, function( data ) {
			UCP.closeDialog();
		});
	},
	playbackFormatter: function (value, row, index) {
		if(row.duration === 0) {
			return '';
		}
		return '<div id="jquery_jplayer_'+row.msg_id+'" class="jp-jplayer" data-container="#jp_container_'+row.msg_id+'" data-id="'+row.msg_id+'"></div><div id="jp_container_'+row.msg_id+'" data-player="jquery_jplayer_'+row.msg_id+'" class="jp-audio-freepbx" role="application" aria-label="media player">'+
			'<div class="jp-type-single">'+
				'<div class="jp-gui jp-interface">'+
					'<div class="jp-controls">'+
						'<i class="fa fa-play jp-play"></i>'+
						'<i class="fa fa-repeat jp-repeat"></i>'+
					'</div>'+
					'<div class="jp-progress">'+
						'<div class="jp-seek-bar progress">'+
							'<div class="jp-current-time" role="timer" aria-label="time">&nbsp;</div>'+
							'<div class="progress-bar progress-bar-striped active" style="width: 100%;"></div>'+
							'<div class="jp-play-bar progress-bar"></div>'+
							'<div class="jp-play-bar">'+
								'<div class="jp-ball"></div>'+
							'</div>'+
							'<div class="jp-duration" role="timer" aria-label="duration">&nbsp;</div>'+
						'</div>'+
					'</div>'+
					'<div class="jp-volume-controls">'+
						'<i class="fa fa-volume-up jp-mute"></i>'+
						'<i class="fa fa-volume-off jp-unmute"></i>'+
					'</div>'+
				'</div>'+
				'<div class="jp-no-solution">'+
					'<span>Update Required</span>'+
					sprintf(_("You are missing support for playback in this browser. To fully support HTML5 browser playback you will need to install programs that can not be distributed with the PBX. If you'd like to install the binaries needed for these conversions click <a href='%s'>here</a>"),"http://wiki.freepbx.org/display/FOP/Installing+Media+Conversion+Libraries")+
				'</div>'+
			'</div>'+
		'</div>';
	},
	durationFormatter: function (value, row, index) {
		return sprintf(_("%s seconds"),value);
	},
	controlFormatter: function (value, row, index) {
		return '<a class="listen" alt="'+_('Listen on your handset')+'" data-id="'+row.msg_id+'"><i class="fa fa-phone"></i></a>'+
						'<a class="forward" alt="'+_('Forward')+'" data-id="'+row.msg_id+'"><i class="fa fa-share"></i></a>'+
						'<a class="download" alt="'+_('Download')+'" href="?quietmode=1&amp;module=voicemail&amp;command=download&amp;msgid='+row.msg_id+'&amp;format=wav&amp;ext='+extension+'" target="_blank"><i class="fa fa-cloud-download"></i></a>'+
						'<a class="delete" alt="'+_('Delete')+'" data-id="'+row.msg_id+'"><i class="fa fa-trash-o"></i></a>';
	},
	bindPlayers: function(getusermedia) {
		var soundBlob = typeof getusermedia !== "undefined" ? getusermedia : false, $this = this;
		if(soundBlob) {
			supportedHTML5 = supportedHTML5.split("wav");
			if(supportedHTML5.indexOf("wav") === -1) {
				supportedHTML5.push("wav");
			}
			supportedHTML5 = supportedHTML5.join(",");
		}
		$(".jp-jplayer").each(function() {
			var container = $(this).data("container"),
					player = $(this),
					msg_id = $(this).data("id");
			$(this).jPlayer({
				ready: function() {
					$(container + " .jp-play").click(function() {
						if($(this).parents(".jp-controls").hasClass("recording")) {
							var type = $(this).parents(".jp-audio-freepbx").data("type");
							$this.recordGreeting(type);
							return;
						}
						if(!player.data("jPlayer").status.srcSet) {
							$(container).addClass("jp-state-loading");
							$.ajax({
								type: 'POST',
								url: "index.php?quietmode=1",
								data: {module: "voicemail", command: "gethtml5", msg_id: msg_id, ext: extension},
								dataType: 'json',
								timeout: 30000,
								success: function(data) {
									if(data.status) {
										player.on($.jPlayer.event.error, function(event) {
											$(container).removeClass("jp-state-loading");
											console.log(event);
										});
										player.one($.jPlayer.event.canplay, function(event) {
											$(container).removeClass("jp-state-loading");
											player.jPlayer("play");
										});
										player.jPlayer( "setMedia", data.files);
									} else {
										alert(data.message);
										$(container).removeClass("jp-state-loading");
									}
								}
							});
						}
					});
				},
				timeupdate: function(event) {
					$(container).find(".jp-ball").css("left",event.jPlayer.status.currentPercentAbsolute + "%");
				},
				ended: function(event) {
					$(container).find(".jp-ball").css("left","0%");
				},
				swfPath: "/js",
				supplied: supportedHTML5,
				cssSelectorAncestor: container,
				wmode: "window",
				useStateClassSkin: true,
				autoBlur: false,
				keyEnabled: true,
				remainingDuration: true,
				toggleDuration: true
			});
			$(this).on($.jPlayer.event.play, function(event) {
				$(this).jPlayer("pauseOthers");
			});
		});

		var acontainer = null;
		$('.jp-play-bar').mousedown(function (e) {
			acontainer = $(this).parents(".jp-audio-freepbx");
			updatebar(e.pageX);
		});
		$(document).mouseup(function (e) {
			if (acontainer) {
				updatebar(e.pageX);
				acontainer = null;
			}
		});
		$(document).mousemove(function (e) {
			if (acontainer) {
				updatebar(e.pageX);
			}
		});

		//update Progress Bar control
		var updatebar = function (x) {
			var player = $("#" + acontainer.data("player")),
					progress = acontainer.find('.jp-progress'),
					maxduration = player.data("jPlayer").status.duration,
					position = x - progress.offset().left,
					percentage = 100 * position / progress.width();

			//Check within range
			if (percentage > 100) {
				percentage = 100;
			}
			if (percentage < 0) {
				percentage = 0;
			}

			player.jPlayer("playHead", percentage);

			//Update progress bar and video currenttime
			acontainer.find('.jp-ball').css('left', percentage+'%');
			acontainer.find('.jp-play-bar').css('width', percentage + '%');
			player.jPlayer.currentTime = maxduration * percentage / 100;
		};
	}
});
