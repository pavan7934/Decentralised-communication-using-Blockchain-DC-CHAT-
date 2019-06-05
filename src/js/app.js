// Upon refresh of page the following happing in order:
//1. initWeb3();
//2. initContract();
//3. checkUserRegistration();
//4. getContractProperties();
//5. displayMyAccountInfo();
//6. getMyBalance();
//7. getMyInboxSize();

var myAddress;
var myInboxSize = 0;
var hasUserRegistered = false;
var currentReceivedMessage = 0;
var replyToAddress = "0x";
var networkid = 0;
var etherscanPrefix = "";

App = {

  web3Provider: null,
  contracts: {},
  account: {},
  loading: false,
  networkid: 0,
  etherscanPrefix: "",

  init: function() {

    $('#mytable').tablesort();
    //document.getElementById("inputSection").hidden = true;
    return App.initWeb3();
  },

  initWeb3: function() {
    // Initialize web3 and set the provider to the testRPC.
    if (typeof web3 !== 'undefined') {
      // Use Mist/MetaMask's provider
      App.web3Provider = web3.currentProvider;
      App.setStatus("MetaMask detected");
    } else {
      // set the provider you want from Web3.providers
      document.getElementById("metamaskModal").style.display = "block";
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
      return null;
    }

    // Get the initial account balance so it can be displayed.
    web3.eth.getAccounts(function(err, accs) {
      if (err != null) {
        alert("There was an error fetching your account, please try again later.");
        return;
      }
      account = accs[0];
      if (!account) {
        //alert("Could not fetch your Ethereum account. Make sure you are logged into MetaMask then refresh the page.");
        App.setStatus("Please login to MetaMask");
        document.getElementById("loginErrorModal").style.display = "block";
        return;
      }

      web3.version.getNetwork((err, netId) => {
        networkid = netId;
        var networkConnection;
        switch (netId) {
          case "1":
            networkConnection = 'Connected to Mainnet';
            etherscanPrefix = "https://etherscan.io/address/";
            break
          case "2":
            networkConnection = 'Connected to Morden (not supported)';
            break
          case "3":
            networkConnection = 'Connected to Ropsten (not supported)';
            break
          case "4":
            networkConnection = 'Connected to Rinkeby';
            etherscanPrefix = "https://rinkeby.etherscan.io/address/";
            break
          case "42":
            networkConnection = 'You are connected to Kovan test network (not supported)';
            break
          default:
            networkConnection = 'You are connected localhost';
        }
        document.getElementById("networkConnection").innerHTML = networkConnection;
      });

      return App.initContract();
    });
  },

  initContract: function() {
    $.getJSON('DChat.json', function(DChatArtifact) {
      // Get the necessary contract artifact file and use it to instantiate a truffle contract abstraction.
      App.contracts.DChat = TruffleContract(DChatArtifact);
      // Set the provider for our contract.
      App.contracts.DChat.setProvider(App.web3Provider);
      // Listen for events
      //App.listenToEvents();
      return App.getContractProperties();
    });
  },

  getContractProperties: function() {
    var self = this;
    var meta;
    App.contracts.DChat.deployed().then(function(instance) {
      meta = instance;
      return meta.getContractProperties.call({from: account, gas: 300000, gasPrice: 20000000000});
    }).then(function(value) {
      var networkAddress = App.contracts.DChat.address;
      document.getElementById("contractAddress").innerHTML = networkAddress;
      document.getElementById("contractAddress").href = etherscanPrefix + networkAddress;
      var by = value[0];
      var numSentMessages = value[2];
      var registeredUsersAddress = value[1];
      var numRegisteredUsers = registeredUsersAddress.length;
      var select = '';
      for (i = 0; i < numRegisteredUsers; i++) {
        select += '<option val=' + i + '>' + registeredUsersAddress[i] + '</option>';
      }
      $('#registeredUsersAddressMenu').html(select);
      document.getElementById("contractOwner").innerHTML = by;
      document.getElementById("contractOwner").href = etherscanPrefix + by; 
      document.getElementById("numRegisteredUsers").innerHTML = "(" + numRegisteredUsers + " registered users)";
    }).catch(function(e) {
      console.log(e);
      self.setStatus("");
    });
    return App.displayMyAccountInfo();
  },

  displayMyAccountInfo: function() {
    web3.eth.getAccounts(function(err, account) {
      if (err === null) {
        App.account = account;
        document.getElementById("myAddress").innerHTML = account;
        document.getElementById("myAddress").href = etherscanPrefix + account;
        web3.eth.getBalance(account[0], function(err, balance) {
          if (err === null) {
            if (balance == 0) {
              document.getElementById("zeroBalanceModal").style.display = "block";
              App.setStatus("Please buy more Ether");
              return;
            } else {
              document.getElementById("myBalance").innerHTML = web3.fromWei(balance, "ether").toNumber() + " Ether";
              return App.checkUserRegistration();
            }
          } else {
            console.log(err);
          }
        });
      }
    });
    return null;
  },

  checkUserRegistration: function() {
    var self = this;
    self.setStatus("Checking user registration...please wait");
    var meta;
    App.contracts.DChat.deployed().then(function(instance) {
      meta = instance;
      return meta.checkUserRegistration.call({from: account});
    }).then(function(value) {
      if (!value) {
        document.getElementById("registerModal").style.display = "block";
      } else {
        self.setStatus("User is registered...ready");
        document.getElementById("inputSection").style.display = "block";
      }
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error checking user registration; see log");
    });
    return App.getMyInboxSize();
  },

  registerUser: function() {
    document.getElementById("registerModal").style.display = "none";
    var self = this;
    self.setStatus("User registration:(open MetaMask->submit->wait)");
    document.getElementById("statusSpinner").style.display = "inline-block";
    var meta;
    App.contracts.DChat.deployed().then(function(instance) {
      meta = instance;
      return meta.registerUser({}, {
        from: account,
        gas: 300000,
        gasPrice: 20000000000
      });
    }).then(function(result) {
      document.getElementById("statusSpinner").style.display = "none";
      var gasUsedWei = result.receipt.gasUsed;
      var gasUsedEther = web3.fromWei(gasUsedWei, "ether");
      self.setStatus("User is registered...gas spent: " + gasUsedWei + "(Wei)");
      hasUserRegistered = true;
      document.getElementById("sendMessageButton").disabled = false;
      document.getElementById("registerConfirmationModal").style.display = "block";
      self.getContractProperties();
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error logging in; see log");
    });

    return null;
  },

  getMyInboxSize: function() {
    var self = this;
    var meta;
    App.contracts.DChat.deployed().then(function(instance) {
      meta = instance;
      return meta.getMyInboxSize.call({from: account, gas: 300000, gasPrice: 20000000000});
    }).then(function(value) {
      myInboxSize = value[1];
      document.getElementById("numSentMessages").innerHTML = "(You have sent " + value[0] + " messages)";
      document.getElementById("numReceivedMessages").innerHTML = "(You have received " + value[1] + " messages)";
      if (myInboxSize > 0) {
        document.getElementById("receivedTable").style.display = "inline";
        return App.receiveMessages();
      } else {
        document.getElementById("receivedTable").style.display = "none";
        return null;
      }
    }).catch(function(e) {
      console.log(e);
      self.setStatus("");
    });
  },

  receiveMessages: function() {
    var self = this;
    var meta;
    App.contracts.DChat.deployed().then(function(instance) {
      meta = instance;
      return meta.receiveMessages.call({}, {
        from: account,
        gas: 300000,
        gasPrice: 20000000000
      });
    }).then(function(value) {
      var content = value[0];
      var timestamp = value[1];
      var sender = value[2];
      for (var m = 0; m < myInboxSize; m++) {
        var tbody = document.getElementById("mytable-tbody");
        var row = tbody.insertRow();
        var cell1 = row.insertCell();
        cell1.innerHTML = self.timeConverter(timestamp[m]);
        var cell2 = row.insertCell();
        cell2.innerHTML = sender[m];
        var cell3 = row.insertCell();

        var thisRowReceivedText = content[m].toString();
        var receivedAscii = web3.toAscii(thisRowReceivedText);
        var thisRowSenderAddress = sender[m];
        var senderAddressAscii = web3.toAscii(thisRowSenderAddress);
        var receivedDecrypted = App.encode(receivedAscii, senderAddressAscii);
        var receivedDecryptedlength = receivedDecrypted.substring(0, 2);
        var decryptedReceivedText = receivedDecrypted.substring(2, parseInt(receivedDecryptedlength) + 2);

        cell3.innerHTML = decryptedReceivedText;
        cell3.hidden = true;
      }
      var table = document.getElementById("mytable");
      var rows = table.rows;
      for (var i = 1; i < rows.length; i++) {
        rows[i].onclick = (function(e) {
          replyToAddress = this.cells[1].innerHTML;
          var thisRowContent = (this.cells[2].innerHTML);
          document.getElementById("reply").innerHTML = thisRowContent;
        });
      }
      // create inbox clear all button
      var clearInboxButton = document.createElement("button");
      clearInboxButton.id = "clearInboxButton";
      clearInboxButton.type = "clearInboxButton";
      clearInboxButton.disabled = false;
      clearInboxButton.style.width = "22%";
      clearInboxButton.style.color = "white";
      clearInboxButton.style.height = "35px";
      clearInboxButton.style.margin = "15px 0px";
      clearInboxButton.style.backgroundImage = "linear-gradient(90deg, #ea4c89, #ee9b83)";
      clearInboxButton.style.borderRadius = "10px";
      clearInboxButton.style.borderColor= "white";
      clearInboxButton.style.fontSize = "15px";
      clearInboxButton.innerHTML = "CLEAR INBOX";
 
      document.getElementById("receivedTable").appendChild(clearInboxButton);
      clearInboxButton.addEventListener("click", function() {
        document.getElementById("clearInboxButton").disabled = true;
        App.clearInbox();
      });
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error getting messages; see log");
    });
    return;
  },

  clearInbox: function() {
    var self = this;
    var meta;
    this.setStatus("Clearing inbox:(open MetaMask->submit->wait)");
    document.getElementById("statusSpinner").style.display = "inline-block";
    App.contracts.DChat.deployed().then(function(instance) {
      meta = instance;
      return meta.clearInbox({}, {
        from: account,
        gas: 300000,
        gasPrice: 20000000000
      });
    }).then(function(value) {
      var clearInboxButton = document.getElementById("clearInboxButton");
      clearInboxButton.parentNode.removeChild(clearInboxButton);
      document.getElementById("numReceivedMessages").innerHTML = "(You have received 0 messages)";
      $("#mytable tr").remove();
      document.getElementById("receivedTable").style.display = "none";
      alert("Your inbox was cleared");
      self.setStatus("Inbox cleared");
      document.getElementById("statusSpinner").style.display = "none";
    }).catch(function(e) {
      document.getElementById("clearInboxButton").disabled = false;
      console.log(e);
      self.setStatus("Error clearing inbox; see log");
    });
  },

  encode: function(s, k) {
    var enc = "";
    var str = "";
    // make sure that input is string
    str = s.toString();
    for (var i = 0; i < s.length; i++) {
      // create block
      var a = s.charCodeAt(i);
      // bitwise XOR
      var b = a ^ k.charCodeAt(i);
      enc = enc + String.fromCharCode(b);
    }
    return enc;
  },

  sendMessage: function() {
    var self = this;
    var receiver = document.getElementById("receiver").value;
    if (receiver == "") {
      App.setStatus("Send address cannot be empty");
      return null;
    }
    if (!web3.isAddress(receiver)) {
      App.setStatus("You did not enter a valid Ethereum address");
      return null;
    }
    var myAddress = document.getElementById("myAddress").innerHTML;
    var newMessage = document.getElementById("message").value;
    if (newMessage == "") {
      App.setStatus("Oops! Message is empty");
      return null;
    }

    //encrypt
    var newMessageLength = newMessage.length;
    if (newMessageLength < 10) {
      newMessageLength = "0" + newMessageLength;
    }
    newMessageEncrypted = App.encode(newMessageLength.toString() + newMessage, web3.toAscii(myAddress));

    var sentMessage = newMessageEncrypted;

    document.getElementById("message").value = "";
    document.getElementById("numSentMessages").innerHTML = "(Your message was encrypted to: " + newMessageEncrypted + ")";
    document.getElementById("sendMessageButton").disabled = true;
    this.setStatus("Sending message:(open MetaMask->submit->wait)");
    document.getElementById("statusSpinner").style.display = "inline-block";

    var meta;
    App.contracts.DChat.deployed().then(function(instance) {
      meta = instance;
      return meta.sendMessage(receiver, sentMessage, {
        from: account,
        gas: 300000,
        gasPrice: 20000000000
      });
    }).then(function(result) {
      console.log(result);
      var gasUsedWei = result.receipt.gasUsed;
      var gasUsedEther = web3.fromWei(gasUsedWei, "ether");
      self.setStatus("Message successfully sent...gas spent: " + gasUsedWei + " Wei");
      document.getElementById("statusSpinner").style.display = "none";
      document.getElementById("sendMessageButton").disabled = false;
      document.getElementById("message").value = "";
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error sending message; see log");
    });
  },

  replyToMessage: function() {
    document.getElementById("message").focus();
    document.getElementById("message").select();
    document.getElementById("receiver").value = replyToAddress;
  },

  copyAddressToSend: function() {
    var sel = document.getElementById("registeredUsersAddressMenu");
    var copyText = sel.options[sel.selectedIndex];
    document.getElementById("receiver").value = copyText.innerHTML;
    document.getElementById("message").focus();
    document.getElementById("message").select();

    //copyText.select();
    //document.execCommand("Copy");
    //alert("Copied the text: " + copyText.value);
  },

  setStatus: function(message) {
    document.getElementById("status").innerHTML = message;
    /*setTimeout(function () {
      document.getElementById("status").innerHTML = "OK";
    }, 5000);*/
  },

 
  timeConverter: function(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp * 1000);
    var months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();

    if (date.toString().length == 1) {
      date = "0" + date;
    }
    if (hour.toString().length == 1) {
      hour = "0" + hour;
    }
    if (min.toString().length == 1) {
      min = "0" + min;
    }
    if (sec.toString().length == 1) {
      sec = "0" + sec;
    }
    //var time = month + ' ' + date + ' ' + year;
    var time = (a.getMonth() + 1) + "/" + date + "/" + year + " " + hour + ":" + min + ":" + sec;
    //var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min;
    return time;
  }
};

$(function() {
  $(window).load(function() {
    App.init();
  });
});
