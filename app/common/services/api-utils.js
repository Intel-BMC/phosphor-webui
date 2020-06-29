/**
 * API utilities service
 *
 * @module app/common/services/api-utils
 * @exports APIUtils
 * @name APIUtils
 */

window.angular && (function(angular) {
  'use strict';
  angular.module('app.common.services').factory('APIUtils', [
    '$http', '$cookies', 'Constants', '$q', 'dataService', '$interval',
    function($http, $cookies, Constants, $q, DataService, $interval) {
      var getScaledValue = function(value, scale) {
        scale = scale + '';
        scale = parseInt(scale, 10);
        var power = Math.abs(parseInt(scale, 10));

        if (scale > 0) {
          value = value * Math.pow(10, power);
        } else if (scale < 0) {
          value = value / Math.pow(10, power);
        }
        return value;
      };
      var baseBoard = '';
      var SERVICE = {
        API_CREDENTIALS: Constants.API_CREDENTIALS,
        API_RESPONSE: Constants.API_RESPONSE,
        HOST_STATE_TEXT: Constants.HOST_STATE,
        LED_STATE: Constants.LED_STATE,
        LED_STATE_TEXT: Constants.LED_STATE_TEXT,
        HOST_SESSION_STORAGE_KEY: Constants.API_CREDENTIALS.host_storage_key,
        validIPV4IP: function(ip) {
          // Checks for [0-255].[0-255].[0-255].[0-255]
          return ip.match(
              /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/);
        },
        getRedfishSysName: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + '/redfish/v1/Systems',
                   withCredentials: true
                 })
              .then(
                  function(response) {
                    var sysUrl = response.data['Members'][0]['@odata.id'];
                    return sysUrl.split('/').pop(-1);
                  },
                  function(error) {
                    console.log(JSON.stringify(error));
                  });
        },
        getSystemLogCount: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            var uri = '/redfish/v1/Systems/' + sysName +
                '/LogServices/EventLog/Entries';
            var initparams = {$top: 1};

            $http({
              method: 'GET',
              url: DataService.getHost() + uri,
              params: initparams,
              withCredentials: true
            })
                .then(
                    function(response) {
                      deferred.resolve(response.data['Members@odata.count']);
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                    });

            return deferred.promise;
          });
        },
        getSystemLogs: function(outputCount, firstRecord) {
          var uri = '/redfish/v1/Systems/system/LogServices/EventLog/Entries';
          var logEntries = [];
          var initparams = {$top: outputCount, $skip: firstRecord};
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + uri,
                   params: initparams,
                   withCredentials: true
                 })
              .then(
                  function(response) {
                    var deferred = $q.defer();
                    angular.forEach(response.data['Members'], function(log) {
                      if (log.hasOwnProperty('Created')) {
                        logEntries.push(log);
                      }
                    });
                    deferred.resolve(logEntries);
                    return deferred.promise;
                  },
                  function(error) {
                    console.log(JSON.stringify(error));
                  });
        },
        clearSystemLogs: function() {
          var uri = '/redfish/v1/Systems/' + DataService.systemName +
              '/LogServices/EventLog/Actions/LogService.ClearLog';
          return $http({
            method: 'POST',
            url: DataService.getHost() + uri,
            withCredentials: true
          });
        },
        deleteObject: function(path) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() + path + '/action/Delete',
                   withCredentials: true,
                   data: JSON.stringify({'data': []})
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getHostState: function() {
          var deferred = $q.defer();
          $http({
            method: 'GET',
            url: DataService.getHost() +
                '/xyz/openbmc_project/state/host0/attr/CurrentHostState',
            withCredentials: true
          })
              .then(
                  function(response) {
                    var json = JSON.stringify(response.data);
                    var content = JSON.parse(json);
                    deferred.resolve(content.data);
                  },
                  function(error) {
                    console.log(error);
                    deferred.reject(error);
                  });
          return deferred.promise;
        },
        getSNMPManagers: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/network/snmp/manager/enumerate',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        pollHostStatusTillOn: function() {
          var deferred = $q.defer();
          var hostOnTimeout = setTimeout(function() {
            ws.close();
            deferred.reject(new Error(Constants.MESSAGES.POLL.HOST_ON_TIMEOUT));
          }, Constants.TIMEOUT.HOST_ON);
          var token = $cookies.get('XSRF-TOKEN');
          var ws = new WebSocket(
              'wss://' + DataService.server_id + '/subscribe', [token]);
          var data = JSON.stringify({
            'paths': ['/xyz/openbmc_project/state/host0'],
            'interfaces': ['xyz.openbmc_project.State.Host']
          });
          ws.onopen = function() {
            ws.send(data);
          };
          ws.onmessage = function(evt) {
            var content = JSON.parse(evt.data);
            var hostState = content.properties.CurrentHostState;
            if (hostState === Constants.HOST_STATE_TEXT.on_code) {
              clearTimeout(hostOnTimeout);
              ws.close();
              deferred.resolve();
            } else if (hostState === Constants.HOST_STATE_TEXT.error_code) {
              clearTimeout(hostOnTimeout);
              ws.close();
              deferred.reject(new Error(Constants.MESSAGES.POLL.HOST_QUIESCED));
            }
          };
        },

        pollHostStatusTilReboot: function() {
          var deferred = $q.defer();
          var onState = Constants.HOST_STATE_TEXT.on_code;
          var offState = Constants.HOST_STATE_TEXT.on_code;
          var hostTimeout;
          var setHostTimeout = function(message, timeout) {
            hostTimeout = setTimeout(function() {
              ws.close();
              deferred.reject(new Error(message));
            }, timeout);
          };
          var token = $cookies.get('XSRF-TOKEN');
          var ws = new WebSocket(
              'wss://' + DataService.server_id + '/subscribe', [token]);
          var data = JSON.stringify({
            'paths': ['/xyz/openbmc_project/state/host0'],
            'interfaces': ['xyz.openbmc_project.State.Host']
          });
          ws.onopen = function() {
            ws.send(data);
          };
          setHostTimeout(
              Constants.MESSAGES.POLL.HOST_OFF_TIMEOUT,
              Constants.TIMEOUT.HOST_OFF);
          var pollState = offState;
          ws.onmessage = function(evt) {
            var content = JSON.parse(evt.data);
            var hostState = content.properties.CurrentHostState;
            if (hostState === pollState) {
              if (pollState === offState) {
                clearTimeout(hostTimeout);
                pollState = onState;
                setHostTimeout(
                    Constants.MESSAGES.POLL.HOST_ON_TIMEOUT,
                    Constants.TIMEOUT.HOST_ON);
              }
              if (pollState === onState) {
                clearTimeout(hostTimeout);
                ws.close();
                deferred.resolve();
              }
            } else if (hostState === Constants.HOST_STATE_TEXT.error_code) {
              clearTimeout(hostTimeout);
              ws.close();
              deferred.reject(new Error(Constants.MESSAGES.POLL.HOST_QUIESCED));
            }
          };
        },

        pollHostStatusTillOff: function() {
          var deferred = $q.defer();
          var hostOffTimeout = setTimeout(function() {
            ws.close();
            deferred.reject(
                new Error(Constants.MESSAGES.POLL.HOST_OFF_TIMEOUT));
          }, Constants.TIMEOUT.HOST_OFF);

          var token = $cookies.get('XSRF-TOKEN');
          var ws = new WebSocket(
              'wss://' + DataService.server_id + '/subscribe', [token]);
          var data = JSON.stringify({
            'paths': ['/xyz/openbmc_project/state/host0'],
            'interfaces': ['xyz.openbmc_project.State.Host']
          });
          ws.onopen = function() {
            ws.send(data);
          };
          ws.onmessage = function(evt) {
            var content = JSON.parse(evt.data);
            var hostState = content.properties.CurrentHostState;
            if (hostState === Constants.HOST_STATE_TEXT.off_code) {
              clearTimeout(hostOffTimeout);
              ws.close();
              deferred.resolve();
            }
          };
        },
        addSNMPManager: function(address, port) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/network/snmp/manager/action/Client',
                   withCredentials: true,
                   data: JSON.stringify({'data': [address, +port]})
                 })
              .then(function(response) {
                return response.data;
              });
        },
        setSNMPManagerPort: function(snmpManagerPath, port) {
          return $http({
                   method: 'PUT',
                   url: DataService.getHost() + snmpManagerPath + '/attr/Port',
                   withCredentials: true,
                   data: JSON.stringify({'data': +port})
                 })
              .then(function(response) {
                return response.data;
              });
        },
        setSNMPManagerAddress: function(snmpManagerPath, address) {
          return $http({
                   method: 'PUT',
                   url: DataService.getHost() + snmpManagerPath +
                       '/attr/Address',
                   withCredentials: true,
                   data: JSON.stringify({'data': address})
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getNetworkInfo: function(outputCount, firstRecord) {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'GET',
              url: DataService.getHost() +
                  '/redfish/v1/Managers/bmc/EthernetInterfaces',
              withCredentials: true
            })
                .then(
                    function(response) {
                      var eths = [];
                      angular.forEach(response.data['Members'], function(eth) {
                        return $http({
                                 method: 'GET',
                                 url: DataService.getHost() + eth['@odata.id'],
                                 withCredentials: true
                               })
                            .then(
                                function(response) {
                                  eths.push(response.data);
                                  deferred.resolve(eths);
                                },
                                function(error) {
                                  console.log(JSON.stringify(error));
                                })
                      });
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        setMACAddress: function(interfaceName, mac_address) {
          var data = {};
          data['MACAddress'] = mac_address;
          return $http({
                   method: 'PATCH',
                   url: DataService.getHost() +
                       '/redfish/v1/Managers/bmc/EthernetInterfaces/' +
                       interfaceName,
                   withCredentials: true,
                   data: data
                 })
              .then(function(response) {
                return response.data;
              });
        },
        setIPv6DefaultGateway: function(interfaceName, defaultGateway) {
          var data = {};
          data['IPv6StaticDefaultGateways'] = defaultGateway;
          return $http({
                   method: 'PATCH',
                   url: DataService.getHost() +
                       '/redfish/v1/Managers/bmc/EthernetInterfaces/' +
                       interfaceName,
                   withCredentials: true,
                   data: data
                 })
              .then(function(response) {
                return response.data;
              });
        },
        setDHCPEnabled: function(interfaceName, dhcpEnabled) {
          var data = {};
          data.DHCPv4 = {};
          data.DHCPv4.DHCPEnabled = dhcpEnabled;
          if (interfaceName) {
            return $http({
                     method: 'PATCH',
                     url: DataService.getHost() +
                         '/redfish/v1/Managers/bmc/EthernetInterfaces/' +
                         interfaceName,
                     withCredentials: true,
                     data: data
                   })
                .then(function(response) {
                  return response.data;
                });
          };
        },
        setNameservers: function(dnsServersArray, interfaceName) {
          if (interfaceName) {
            return $http({
                     method: 'PATCH',
                     url: DataService.getHost() +
                         '/redfish/v1/Managers/bmc/EthernetInterfaces/' +
                         interfaceName,
                     withCredentials: true,
                     data: JSON.stringify(
                         {'StaticNameServers': dnsServersArray})
                   })
                .then(function(response) {
                  return response.data;
                });
          };
        },
        addIPv4StaticAddress: function(
            IPv4StaticAddressesArray, interfaceName) {
          if (interfaceName) {
            return $http({
                     method: 'PATCH',
                     url: DataService.getHost() +
                         '/redfish/v1/Managers/bmc/EthernetInterfaces/' +
                         interfaceName,
                     withCredentials: true,
                     data: JSON.stringify(
                         {'IPv4StaticAddresses': IPv4StaticAddressesArray})
                   })
                .then(function(response) {
                  return response.data;
                });
          }
        },
        getLEDState: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'GET',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName,
              withCredentials: true
            })
                .then(
                    function(response) {
                      var json = JSON.stringify(response.data);
                      var content = JSON.parse(json);
                      deferred.resolve(content.IndicatorLED);
                    },
                    function(error) {
                      console.log(error);
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        getUserPrivilleage: function(username) {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/redfish/v1/AccountService/Accounts/' + username,
                   withCredentials: true
                 })
              .then(
                  function(response) {
                    if (response.data) {
                      const userValue = {
                        UserName: username,
                        RoleId: response.data.RoleId
                      };
                      return userValue;
                    };
                  },
                  function(error) {

                  })
        },
        login: function(username, password, callback) {
          $http({
            method: 'POST',
            url: DataService.getHost() + '/login',
            withCredentials: true,
            data: JSON.stringify({'data': [username, password]})
          })
              .then(
                  function(response) {
                    if (callback) {
                      callback(response.data);
                    }
                  },
                  function(error) {
                    if (callback) {
                      if (error && error.status && error.status == 'error') {
                        callback(error);
                      } else {
                        callback(error, true);
                      }
                    }
                    console.log(error);
                  });
        },
        logout: function(callback) {
          $http({
            method: 'POST',
            url: DataService.getHost() + '/logout',
            withCredentials: true,
            data: JSON.stringify({'data': []})
          })
              .then(
                  function(response) {
                    if (callback) {
                      callback(response.data);
                    }
                  },
                  function(error) {
                    if (callback) {
                      callback(null, error);
                    }
                    console.log(error);
                  });
        },
        getAccountServiceRoles: function() {
          var roles = [];

          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/redfish/v1/AccountService/Roles',
                   withCredentials: true
                 })
              .then(function(response) {
                var members = response.data['Members'];
                angular.forEach(members, function(member) {
                  roles.push(member['@odata.id'].split('/').pop());
                });
                return roles;
              });
        },
        getAllUserAccounts: function() {
          var deferred = $q.defer();
          var promises = [];

          $http({
            method: 'GET',
            url: DataService.getHost() + '/redfish/v1/AccountService/Accounts',
            withCredentials: true
          })
              .then(
                  function(response) {
                    var members = response.data['Members'];
                    angular.forEach(members, function(member) {
                      promises.push(
                          $http({
                            method: 'GET',
                            url: DataService.getHost() + member['@odata.id'],
                            withCredentials: true
                          }).then(function(res) {
                            return res.data;
                          }));
                    });

                    $q.all(promises).then(
                        function(results) {
                          deferred.resolve(results);
                        },
                        function(errors) {
                          deferred.reject(errors);
                        });
                  },
                  function(error) {
                    console.log(error);
                    deferred.reject(error);
                  });
          return deferred.promise;
        },

        getAllUserAccountProperties: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + '/redfish/v1/AccountService',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },

        saveUserAccountProperties: function(lockoutduration, lockoutthreshold) {
          var data = {};
          if (lockoutduration != undefined) {
            data['AccountLockoutDuration'] = lockoutduration;
          }
          if (lockoutthreshold != undefined) {
            data['AccountLockoutThreshold'] = lockoutthreshold;
          }

          return $http({
            method: 'PATCH',
            url: DataService.getHost() + '/redfish/v1/AccountService',
            withCredentials: true,
            data: data
          });
        },

        saveLdapProperties: function(properties) {
          return $http({
            method: 'PATCH',
            url: DataService.getHost() + '/redfish/v1/AccountService',
            withCredentials: true,
            data: properties
          });
        },
        createUser: function(user, passwd, role, enabled) {
          var data = {};
          data['UserName'] = user;
          data['Password'] = passwd;
          data['RoleId'] = role;
          data['Enabled'] = enabled;

          return $http({
            method: 'POST',
            url: DataService.getHost() + '/redfish/v1/AccountService/Accounts',
            withCredentials: true,
            data: data
          });
        },
        updateUser: function(user, newUser, passwd, role, enabled, locked) {
          var data = {};
          if ((newUser !== undefined) && (newUser != null)) {
            data['UserName'] = newUser;
          }
          if ((role !== undefined) && (role != null)) {
            data['RoleId'] = role;
          }
          if ((enabled !== undefined) && (enabled != null)) {
            data['Enabled'] = enabled;
          }
          if ((passwd !== undefined) && (passwd != null)) {
            data['Password'] = passwd;
          }
          if ((locked !== undefined) && (locked !== null)) {
            data['Locked'] = locked
          }
          return $http({
            method: 'PATCH',
            url: DataService.getHost() +
                '/redfish/v1/AccountService/Accounts/' + user,
            withCredentials: true,
            data: data
          });
        },
        deleteUser: function(user) {
          return $http({
            method: 'DELETE',
            url: DataService.getHost() +
                '/redfish/v1/AccountService/Accounts/' + user,
            withCredentials: true,
          });
        },
        setLEDState: function(state) {
          return this.getRedfishSysName().then(function(sysName) {
            var data = {};
            if (state) {
              data['IndicatorLED'] = Constants.LED_STATE_TEXT.on;
            } else {
              data['IndicatorLED'] = Constants.LED_STATE_TEXT.off;
            }
            return $http({
              method: 'PATCH',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName,
              withCredentials: true,
              data: data
            });
          });
        },
        getBootOptions: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + '/redfish/v1/Systems/system',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        saveBootSettings: function(data) {
          return this.getRedfishSysName().then(function(sysName) {
            return $http({
              method: 'PATCH',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName,
              withCredentials: true,
              data: data
            });
          });
        },
        getTPMStatus: function() {
          return this.getRedfishSysName().then(function(sysName) {
            return $http({
                     method: 'GET',
                     url: DataService.getHost() + '/redfish/v1/Systems/' +
                         sysName,
                     withCredentials: true
                   })
                .then(function(response) {
                  return response.data;
                });
          });
        },
        saveTPMEnable: function(interfacetype) {
          var data = {};
          data['TrustedModule']['InterfaceType'] = interfacetype;
          return this.getRedfishSysName().then(function(sysName) {
            return $http({
              method: 'PATCH',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName,
              withCredentials: true,
              data: data
            });
          });
        },
        bmcReboot: function() {
          return $http({
            method: 'POST',
            url: DataService.getHost() +
                '/redfish/v1/Managers/bmc/Actions/Manager.Reset',
            withCredentials: true,
            data: JSON.stringify({'ResetType': 'GracefulRestart'})
          });
        },
        hostPowerOn: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'POST',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName +
                  '/Actions/ComputerSystem.Reset',
              withCredentials: true,
              data: JSON.stringify({'ResetType': 'On'})
            })
                .then(
                    function(response) {
                      var json = JSON.stringify(response.data);
                      var content = JSON.parse(json);
                      deferred.resolve(content.status);
                    },
                    function(error) {
                      console.log(error);
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        forceOff: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'POST',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName +
                  '/Actions/ComputerSystem.Reset',
              withCredentials: true,
              data: JSON.stringify({'ResetType': 'ForceOff'})
            })
                .then(
                    function(response) {
                      var json = JSON.stringify(response.data);
                      var content = JSON.parse(json);
                      deferred.resolve(content.status);
                    },
                    function(error) {
                      console.log(error);
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        gracefulShutdown: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'POST',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName +
                  '/Actions/ComputerSystem.Reset',
              withCredentials: true,
              data: JSON.stringify({'ResetType': 'GracefulShutdown'})
            })
                .then(
                    function(response) {
                      var json = JSON.stringify(response.data);
                      var content = JSON.parse(json);
                      deferred.resolve(content.status);
                    },
                    function(error) {
                      console.log(error);
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        gracefulRestart: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'POST',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName +
                  '/Actions/ComputerSystem.Reset',
              withCredentials: true,
              data: JSON.stringify({'ResetType': 'GracefulRestart'})
            })
                .then(
                    function(response) {
                      var json = JSON.stringify(response.data);
                      var content = JSON.parse(json);
                      deferred.resolve(content.status);
                    },
                    function(error) {
                      console.log(error);
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        getLastPowerTime: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/state/chassis0/attr/LastStateChangeTime',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getSensorsInfo: function(url) {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + url,
                   withCredentials: true
                 })
              .then(
                  function(response) {
                    return response.data;
                  },
                  function(error) {
                    console.log(JSON.stringify(error));
                  });
        },
        getAllChassisCollection: function() {
          var deferred = $q.defer();
          var promises = [];
          $http({
            method: 'GET',
            url: DataService.getHost() + '/redfish/v1/Chassis',
            withCredentials: true
          })
              .then(
                  function(response) {
                    var members = response.data['Members'];
                    angular.forEach(
                        members,
                        function(member) {
                          promises.push($http({
                                          method: 'GET',
                                          url: DataService.getHost() +
                                              member['@odata.id'],
                                          withCredentials: true
                                        }).then(function(res) {
                            return res.data;
                          }));
                        }),
                        $q.all(promises).then(
                            function(results) {
                              deferred.resolve(results);
                            },
                            function(errors) {
                              deferred.reject(errors);
                            });
                  },
                  function(error) {
                    console.log(JSON.stringify(error));
                  });
          return deferred.promise;
        },
        getActivation: function(imageId) {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/software/' + imageId +
                       '/attr/Activation',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getBMCInformation: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + '/redfish/v1/Managers/bmc',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getFirmwares: function() {
          var deferred = $q.defer();
          $http({
            method: 'GET',
            url: DataService.getHost() +
                '/xyz/openbmc_project/software/enumerate',
            withCredentials: true
          })
              .then(
                  function(response) {
                    var json = JSON.stringify(response.data);
                    var content = JSON.parse(json);
                    var data = [];
                    var isExtended = false;
                    var bmcActiveVersion = '';
                    var hostActiveVersion = '';
                    var imageType = '';
                    var extendedVersions = [];
                    var functionalImages = [];

                    function getFormatedExtendedVersions(extendedVersion) {
                      var versions = [];
                      extendedVersion = extendedVersion.split(',');

                      extendedVersion.forEach(function(item) {
                        var parts = item.split('-');
                        var numberIndex = 0;
                        for (var i = 0; i < parts.length; i++) {
                          if (/[0-9]/.test(parts[i])) {
                            numberIndex = i;
                            break;
                          }
                        }
                        if (numberIndex > 0) {
                          var titlePart = parts.splice(0, numberIndex);
                          titlePart = titlePart.join('');
                          titlePart = titlePart[0].toUpperCase() +
                              titlePart.substr(1, titlePart.length);
                          var versionPart = parts.join('-');
                          versions.push(
                              {title: titlePart, version: versionPart});
                        }
                      });

                      return versions;
                    }

                    // Get the list of functional images so we can compare
                    // later if an image is functional
                    if (content.data[Constants.FIRMWARE.FUNCTIONAL_OBJPATH]) {
                      functionalImages =
                          content.data[Constants.FIRMWARE.FUNCTIONAL_OBJPATH]
                              .endpoints;
                    }
                    for (var key in content.data) {
                      if (content.data.hasOwnProperty(key) &&
                          content.data[key].hasOwnProperty('Version')) {
                        var activationStatus = '';

                        // If the image is "Functional" use that for the
                        // activation status, else use the value of
                        // "Activation"
                        // github.com/openbmc/phosphor-dbus-interfaces/blob/master/xyz/openbmc_project/Software/Activation.interface.yaml
                        if (content.data[key].Activation) {
                          activationStatus =
                              content.data[key].Activation.split('.').pop();
                        }

                        if (functionalImages.includes(key)) {
                          activationStatus = 'Functional';
                        }

                        imageType = content.data[key].Purpose.split('.').pop();
                        isExtended = content.data[key].hasOwnProperty(
                                         'ExtendedVersion') &&
                            content.data[key].ExtendedVersion != '';
                        if (isExtended) {
                          extendedVersions = getFormatedExtendedVersions(
                              content.data[key].ExtendedVersion);
                        }
                        data.push(Object.assign(
                            {
                              path: key,
                              activationStatus: activationStatus,
                              imageId: key.split('/').pop(),
                              imageType: imageType,
                              isExtended: isExtended,
                              extended:
                                  {show: false, versions: extendedVersions},
                              data: {key: key, value: content.data[key]}
                            },
                            content.data[key]));

                        if (activationStatus == 'Functional' &&
                            imageType == 'BMC') {
                          bmcActiveVersion = content.data[key].Version;
                        }

                        if (activationStatus == 'Functional' &&
                            imageType == 'Host') {
                          hostActiveVersion = content.data[key].Version;
                        }
                      }
                    }

                    deferred.resolve({
                      data: data,
                      bmcActiveVersion: bmcActiveVersion,
                      hostActiveVersion: hostActiveVersion
                    });
                  },
                  function(error) {
                    console.log(error);
                    deferred.reject(error);
                  });

          return deferred.promise;
        },
        changePriority: function(imageId, priority) {
          return $http({
                   method: 'PUT',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/software/' + imageId +
                       '/attr/Priority',
                   withCredentials: true,
                   data: JSON.stringify({'data': priority})
                 })
              .then(function(response) {
                return response.data;
              });
        },
        deleteImage: function(imageId) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/software/' + imageId +
                       '/action/Delete',
                   withCredentials: true,
                   data: JSON.stringify({'data': []})
                 })
              .then(function(response) {
                return response.data;
              });
        },
        activateImage: function(imageId) {
          return $http({
                   method: 'PUT',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/software/' + imageId +
                       '/attr/RequestedActivation',
                   withCredentials: true,
                   data: JSON.stringify(
                       {'data': Constants.FIRMWARE.ACTIVATE_FIRMWARE})
                 })
              .then(function(response) {
                return response.data;
              });
        },
        uploadImage: function(file) {
          return $http({
                   method: 'POST',
                   timeout: 5 * 60 * 1000,
                   url: DataService.getHost() + '/redfish/v1/UpdateService',
                   // Overwrite the default 'application/json' Content-Type
                   headers: {'Content-Type': file.type},
                   withCredentials: true,
                   data: file
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getFirmwareUpdateTarget: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + '/redfish/v1/UpdateService',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        setHttpPushUriApplyTime: function(json) {
          return $http({
                   method: 'PATCH',
                   url: DataService.getHost() + '/redfish/v1/UpdateService',
                   headers: {'Content-Type': 'application/json'},
                   withCredentials: true,
                   data: JSON.stringify(json)
                 })
              .then(function(response) {
                return response.data;
              });
        },
        downloadImage: function(host, filename) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/software/action/DownloadViaTFTP',
                   withCredentials: true,
                   data: JSON.stringify({'data': [filename, host]}),
                   responseType: 'arraybuffer'
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getServerInfo: function() {
          // TODO: openbmc/openbmc#3117 Need a way via REST to get
          // interfaces so we can get the system object(s) by the looking
          // for the system interface.
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + '/redfish/v1/Systems/system',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getBMCTime: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + '/redfish/v1/Managers/bmc',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getTime: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/time/enumerate',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        setNTPServers: function(ntpServers) {
          var data = {};
          data.NTP = {};
          data.NTP.NTPServers = ntpServers;
          return $http({
            method: 'PATCH',
            url: DataService.getHost() +
                '/redfish/v1/Managers/bmc/NetworkProtocol',
            withCredentials: true,
            data: data
          });
        },
        setNTPEnabled: function(useNTP) {
          return $http({
            method: 'PATCH',
            url: DataService.getHost() +
                '/redfish/v1/Managers/bmc/NetworkProtocol',
            withCredentials: true,
            data: JSON.stringify({'NTP': {'ProtocolEnabled': useNTP}})
          });
        },
        getCertificateLocations: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/redfish/v1/CertificateService/CertificateLocations',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getCertificate: function(location) {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + location,
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        addNewCertificate: function(file, type) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() + type.location,
                   headers: {'Content-Type': 'application/x-pem-file'},
                   withCredentials: true,
                   data: file
                 })
              .then(function(response) {
                return response.data;
              });
        },
        createCSRCertificate: function(data) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() +
                       '/redfish/v1/CertificateService/Actions/CertificateService.GenerateCSR',
                   withCredentials: true,
                   data: data
                 })
              .then(function(response) {
                return response.data['CSRString'];
              });
        },
        replaceCertificate: function(data) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() +
                       '/redfish/v1/CertificateService/Actions/CertificateService.ReplaceCertificate',
                   withCredentials: true,
                   data: data
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getDevices: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            var Devices = [];
            var addinFunctions;
            var cId = '';
            var pId = '';
            var evenOdd = true;
            return $http(getRequest('/redfish/v1/Systems/' + sysName))
                .then(function(r1) {
                  const pciDevices = r1.data['PCIeDevices'];
                  if (!pciDevices || pciDevices.length === 0) {
                    return deferred.resolve(Devices);
                  }
                  angular.forEach(pciDevices, function(system) {
                    return $http(getRequest(system['@odata.id']))
                        .then(
                            function(r2) {
                              // nested 2nd level
                              angular.forEach(
                                  r2.data['PCIeFunctions'], function(system) {
                                    return $http(getRequest(
                                                     r2.data['PCIeFunctions']
                                                            ['@odata.id']))
                                        .then(
                                            function(r3) {
                                              // nested 3rd level
                                              angular.forEach(
                                                  r3.data['Members'],
                                                  function(system) {
                                                    return $http({
                                                             method: 'GET',
                                                             url:
                                                                 DataService
                                                                     .getHost() +
                                                                 system
                                                                     ['@odata.id'],
                                                             withCredentials:
                                                                 true
                                                           })
                                                        .then(
                                                            function(r4) {
                                                              Devices.push(
                                                                  getManufacturer(
                                                                      addinFunctions,
                                                                      r2, r4,
                                                                      pId, cId,
                                                                      evenOdd));
                                                              deferred.resolve(
                                                                  Devices);
                                                            },
                                                            function(error) {
                                                              console.log(
                                                                  JSON.stringify(
                                                                      error));
                                                            });
                                                  });
                                            },
                                            function(error) {
                                              console.log(
                                                  JSON.stringify(error));
                                            });
                                  });
                            },
                            function(error) {
                              console.log(JSON.stringify(error));
                            });
                  });
                  return deferred.promise;
                });
          });
        },
        getDIMMs: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'GET',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName +
                  '/Memory',
              withCredentials: true
            })
                .then(
                    function(response) {
                      var dimms = [];
                      const members = response.data['Members'];
                      if (!members || members.length === 0) {
                        return deferred.resolve(dimms);
                      }
                      angular.forEach(members, function(dimm) {
                        return $http({
                                 method: 'GET',
                                 url: DataService.getHost() + dimm['@odata.id'],
                                 withCredentials: true
                               })
                            .then(
                                function(response) {
                                  dimms.push(response.data);
                                  deferred.resolve(dimms);
                                },
                                function(error) {
                                  console.log(JSON.stringify(error));
                                })
                      });
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        getCPUs: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'GET',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName +
                  '/Processors',
              withCredentials: true
            })
                .then(
                    function(response) {
                      var cpu = [];
                      const members = response.data['Members'];
                      if (!members || members.length === 0) {
                        return deferred.resolve(cpu);
                      }
                      angular.forEach(
                          response.data['Members'], function(system) {
                            return $http({
                                     method: 'GET',
                                     url: DataService.getHost() +
                                         system['@odata.id'],
                                     withCredentials: true
                                   })
                                .then(
                                    function(response) {
                                      cpu.push(response.data);
                                      deferred.resolve(cpu);
                                    },
                                    function(error) {
                                      console.log(JSON.stringify(error));
                                    })
                          });
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        getDrives: function() {
          return this.getRedfishSysName().then(function(sysName) {
            var deferred = $q.defer();
            $http({
              method: 'GET',
              url: DataService.getHost() + '/redfish/v1/Systems/' + sysName +
                  '/Storage',
              withCredentials: true
            })
                .then(
                    function(response) {
                      var drive = [];
                      const drives = response.data['Members'];
                      if (!drives || drives.length === 0) {
                        return deferred.resolve(drive);
                      }
                      angular.forEach(drives, function(system) {
                        return $http({
                                 method: 'GET',
                                 url: DataService.getHost() +
                                     system['@odata.id'],
                                 withCredentials: true
                               })
                            .then(
                                function(response2) {
                                  angular.forEach(
                                      response2.data['Drives'],
                                      function(system) {
                                        return $http({
                                                 method: 'GET',
                                                 url: DataService.getHost() +
                                                     system['@odata.id'],
                                                 withCredentials: true
                                               })
                                            .then(
                                                function(response3) {
                                                  drive.push(response3.data);
                                                  deferred.resolve(drive);
                                                },
                                                function(error) {
                                                  console.log(
                                                      JSON.stringify(error));
                                                })
                                      })
                                },
                                function(error) {
                                  console.log(JSON.stringify(error));
                                })
                      })
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                      deferred.reject(error);
                    });
            return deferred.promise;
          });
        },
        deleteRedfishObject: function(objectPath) {
          return $http({
                   method: 'DELETE',
                   url: DataService.getHost() + objectPath,
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        deleteLogs: function(logs) {
          var defer = $q.defer();
          var promises = [];

          function finished() {
            defer.resolve();
          }
          logs.forEach(function(item) {
            promises.push($http({
              method: 'POST',
              url: DataService.getHost() +
                  '/xyz/openbmc_project/logging/entry/' + item.Id +
                  '/action/Delete',
              withCredentials: true,
              data: JSON.stringify({'data': []})
            }));
          });

          $q.all(promises).then(finished);

          return defer.promise;
        },
        resolveLogs: function(logs) {
          var promises = [];

          logs.forEach(function(item) {
            promises.push($http({
              method: 'PUT',
              url: DataService.getHost() +
                  '/xyz/openbmc_project/logging/entry/' + item.Id +
                  '/attr/Resolved',
              withCredentials: true,
              data: JSON.stringify({'data': true})
            }));
          });
          return $q.all(promises);
        },
        setRemoteLoggingServer: (data) => {
          const ip = data.hostname;
          const port = data.port;
          const setIPRequest = $http({
            method: 'PUT',
            url: DataService.getHost() +
                '/xyz/openbmc_project/logging/config/remote/attr/Address',
            withCredentials: true,
            data: {'data': ip}
          });
          const setPortRequest = $http({
            method: 'PUT',
            url: DataService.getHost() +
                '/xyz/openbmc_project/logging/config/remote/attr/Port',
            withCredentials: true,
            data: {'data': port}
          });
          const promises = [setIPRequest, setPortRequest];
          return $q.all(promises);
        },
        getRemoteLoggingServer: () => {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/logging/config/remote',
                   withCredentials: true
                 })
              .then((response) => {
                const remoteServer = response.data.data;
                if (remoteServer === undefined) {
                  return undefined;
                }
                const hostname = remoteServer.Address;
                const port = remoteServer.Port;
                if (hostname === '') {
                  return undefined;
                } else {
                  return {
                    hostname, port
                  }
                }
              });
        },
        disableRemoteLoggingServer: () => {
          return SERVICE.setRemoteLoggingServer({hostname: '', port: 0});
        },
        updateRemoteLoggingServer: (data) => {
          // Recommended to disable existing configuration
          // before updating config to new server
          // https://github.com/openbmc/phosphor-logging#changing-the-rsyslog-server
          return SERVICE.disableRemoteLoggingServer()
              .then(() => {
                return SERVICE.setRemoteLoggingServer(data);
              })
              .catch(() => {
                // try updating server even if initial disable attempt fails
                return SERVICE.setRemoteLoggingServer(data);
              });
        },
        getNTPValues: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/redfish/v1/Managers/bmc/NetworkProtocol',
                   withCredentials: true
                 })
              .then(
                  function(response) {
                    return response.data;
                  },
                  function(error) {
                    console.log(JSON.stringify(error));
                  });
        },
        getHealthStatus: function() {
          return this.getRedfishSysName().then(function(sysName) {
            return $http({
                     method: 'GET',
                     url: DataService.getHost() + '/redfish/v1/Systems/' +
                         sysName,
                     withCredentials: true
                   })
                .then(
                    function(response) {
                      return response.data;
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                    });
          });
        },
        getServerStatus: function() {
          return this.getRedfishSysName().then(function(sysName) {
            return $http({
                     method: 'GET',
                     url: DataService.getHost() + '/redfish/v1/Systems/' +
                         sysName,
                     withCredentials: true
                   })
                .then(
                    function(response) {
                      return response.data;
                    },
                    function(error) {
                      console.log(JSON.stringify(error));
                    });
          });
        },
        getPowerConsumption: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/sensors/power/total_power',
                   withCredentials: true
                 })
              .then(
                  function(response) {
                    var json = JSON.stringify(response.data);
                    var content = JSON.parse(json);

                    return getScaledValue(
                               content.data.Value, content.data.Scale) +
                        ' ' +
                        Constants.POWER_CONSUMPTION_TEXT[content.data.Unit];
                  },
                  function(error) {
                    if ('Not Found' == error.statusText) {
                      return Constants.POWER_CONSUMPTION_TEXT.notavailable;
                    } else {
                      throw error;
                    }
                  });
        },
        getChassisBaseboardUri: function() {
          var deferred = $q.defer();
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + '/redfish/v1/Chassis',
                   withCredentials: true
                 })
              .then(
                  function(response) {
                    const chassis = response.data.Members;
                    angular.forEach(chassis, function(res) {
                      if (res['@odata.id'].indexOf('_Baseboard') > -1) {
                        baseBoard = res['@odata.id'];
                      }
                    });
                    deferred.resolve(response.data);
                    return response.data;
                  },
                  function(error) {
                    console.log(JSON.stringify(error));
                    deferred.reject(error);
                  });
        },
        getPowerCap: function() {
          var deferred = $q.defer();
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + baseBoard + '/Power',
                   withCredentials: true
                 })
              .then(function(response) {
                deferred.resolve(response.data);
                return response.data;
              })
        },
        setPowerCapEnable: function(powerCapEnable) {
          return $http({
                   method: 'PUT',
                   url: DataService.getHost() +
                       '/xyz/openbmc_project/control/host0/power_cap/attr/PowerCapEnable',
                   withCredentials: true,
                   data: JSON.stringify({'data': powerCapEnable})
                 })
              .then(function(response) {
                return response.data;
              });
        },
        setPowerCap: function(powerCap) {
          const json = {PowerControl: [{PowerLimit: {LimitInWatts: powerCap}}]};
          return $http({
                   method: 'PATCH',
                   url: DataService.getHost() + baseBoard + '/Power',
                   withCredentials: true,
                   data: JSON.stringify(json)
                 })
              .then(function(response) {
                return response.data;
              });
        },
        setHostname: function(interfaceName, hostname) {
          var data = {};
          data['HostName'] = hostname;
          return $http({
                   method: 'PATCH',
                   url: DataService.getHost() +
                       '/redfish/v1/Managers/bmc/EthernetInterfaces/' +
                       interfaceName,
                   withCredentials: true,
                   data: data
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getVMCollection: function() {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() +
                       '/redfish/v1/Managers/bmc/VirtualMedia',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        getRedfishObject: function(objectPath) {
          return $http({
                   method: 'GET',
                   url: DataService.getHost() + objectPath,
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        mountImage: function(index, data) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() +
                       '/redfish/v1/Managers/bmc/VirtualMedia/' + index +
                       '/Actions/VirtualMedia.InsertMedia',
                   data: data,
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
        unmountImage: function(index) {
          return $http({
                   method: 'POST',
                   url: DataService.getHost() +
                       '/redfish/v1/Managers/bmc/VirtualMedia/' + index +
                       '/Actions/VirtualMedia.EjectMedia',
                   withCredentials: true
                 })
              .then(function(response) {
                return response.data;
              });
        },
      };
      var getRequest = function(urlString) {
        return {
          method: 'GET', url: DataService.getHost() + urlString,
              withCredentials: true
        }
      };
      var getManufacturer = function(
          addinFunctions, r2, r4, pId, cId, evenOdd) {
        addinFunctions = r4.data;
        addinFunctions.Manufacturer = r2.data['Manufacturer'];
        cId = r2.data['Id'];
        if (pId != cId) {
          addinFunctions.GroupedBy = cId;
          evenOdd = !evenOdd;
        };
        addinFunctions.ParentId = cId;
        addinFunctions.EvenOdd = evenOdd;
        pId = r2.data['Id'];
        return addinFunctions;
      };
      return SERVICE;
    }
  ]);
})(window.angular);
