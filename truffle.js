var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "grief average sponsor quantum few glad total frame social shallow raise pilot";

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 6385876,
      gasPrice: 20000000000
    },
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/v3/fd9378d552b74048b59acc4c069e8e3e");
        },
        network_id:4,
        gas: 6385876,
        gasPrice: 20000000000
    }
  }
  
};
