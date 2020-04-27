/**
 * Controller for network
 *
 * @module app/configuration
 * @exports networkController
 * @name networkController
 */

window.angular && (function(angular) {
  'use strict';

  angular.module('app.configuration').controller('networkController', [
    '$scope', 'APIUtils', '$filter', 'dataService', '$timeout', '$route', '$q',
    'toastService',
    function(
        $scope, APIUtils, $filter, dataService, $timeout, $route, $q,
        toastService) {
      $scope.dataService = dataService;
      $scope.oldInterface = {};
      $scope.interface = {};
      $scope.filterById = '';
      $scope.IPv6DefaultGateway = '';
      $scope.selectedInterface = '';
      $scope.confirmSettings = false;
      $scope.loading = true;
      $scope.editIPV4Settings = [];
      $scope.editDNSSettings = [];
      $scope.ipv4sToDelete = [];
      $scope.rowUpdate = false;
      $scope.dnsUpdate = false;
      $scope.ipv4Update = false;
      $scope.dismiss = false;
      $scope.interface.IPv4Addresses = [];
      $scope.interface.IPv4StaticAddresses = [];
      $scope.interface.StaticNameServers = [];
      $scope.removeIPv4Addresses = [];
      $scope.IPv4AddressesArray = [];
      $scope.dnsServersArray = [];
      $scope.toAddOnEndofArray = [];
      $scope.toAddOnEndofDNSArray = [];
      $scope.validateIPV4 = false;

      loadNetworkInfo();

      $scope.addDNSField = function(newRow) {
        $scope.editDNSSettings[$scope.interface.StaticNameServers.length] =
            true;

        if ((newRow && $scope.interface.StaticNameServers == false) ||
            !newRow) {
          $scope.interface.StaticNameServers.push('');
        }
      };

      $scope.removeDNSField = function(index) {
        $scope.interface.StaticNameServers.splice(index, 1);
        $scope.dnsUpdate = true;
        $scope.updatedRow();
      };

      $scope.addIpv4Field = function(newRow) {
        $scope.editIPV4Settings[$scope.interface.IPv4Addresses.length] = true;
        if ((newRow && $scope.interface.IPv4Addresses == false) || !newRow) {
          $scope.interface.IPv4Addresses.push(
              {Address: '', SubnetMask: '', Gateway: ''});
        }
      };

      $scope.removeIpv4Address = function(index) {
        // Check if the IPV4 being removed has an id. This indicates that it is
        // an existing address and needs to be removed in the back end.
        $scope.removeIPv4Addresses.push(index);

        if ($scope.interface.IPv4Addresses[index].id) {
          $scope.ipv4sToDelete.push($scope.interface.IPv4Addresses[index]);
        }
        $scope.interface.IPv4Addresses.splice(index, 1);
        $scope.updatedipv4();
        $scope.updatedRow();
      };

      $scope.updatedRow = function() {
        $scope.rowUpdate = true;
      };

      $scope.isValidIPv4Address = function(ipValue) {
        const regex = /^(?=\d+\.\d+\.\d+\.\d+$)/;
        const match = (ipValue) ? ipValue.split('.') : '';
        if (match[0] < 256 && match[1] < 256 && match[2] < 256 &&
            match[3] < 256) {
          return regex.test(ipValue);
        }
      };

      $scope.updatedDNS = function() {
        $scope.dnsUpdate = true;
      };

      $scope.updatedipv4 = function() {
        $scope.ipv4Update = true;
      };

      $scope.validate = function() {
        for (let i = 0; i < $scope.interface.IPv4Addresses.length; i++) {
          if ($scope.interface.IPv4Addresses[i]) {
            if (!APIUtils.validIPV4IP(
                    $scope.interface.IPv4Addresses[i].Address)) {
              toastService.error(
                  $scope.interface.IPv4Addresses[i].Address +
                  ' invalid IP parameter');
              $scope.loading = false;
              return false;
            }

            if ($scope.interface.IPv4Addresses[i].Gateway &&
                !APIUtils.validIPV4IP(
                    $scope.interface.IPv4Addresses[i].Gateway)) {
              toastService.error(
                  $scope.interface.IPv4Addresses[i].Address +
                  ' invalid gateway parameter');
              $scope.loading = false;
              return false;
            }

            if ($scope.interface.IPv4Addresses[i].SubnetMask &&
                !APIUtils.validIPV4IP(
                    $scope.interface.IPv4Addresses[i].SubnetMask)) {
              toastService.error(
                  $scope.interface.IPv4Addresses[i].Address +
                  ' invalid subnet mask parameter');
              $scope.loading = false;
              return false;
            }
          }
        }
        return true;
      };

      $scope.setNetworkSettings = function() {
        // Hides the confirm network settings modal
        $scope.confirmSettings = false;
        $scope.loading = true;
        var promises = [];

        // TODO: Re-enable when MACAddress allows updating in Redfish
        // get Base.1.4.0.InternalError

        // MAC Address are case-insensitive
        /*
        if ($scope.interface.MACAddress.toLowerCase() !=
            $scope.oldInterface.MACAddress.toLowerCase()) {
          promises.push(setMACAddress());
        }
        */

        // TODO: Re-enable when IPv6StaticDefaultGateways is available in
        // Redfish (IPv6DefaultGateway is readonly)
        /*
        if ($scope.IPv6DefaultGateway != dataService.IPv6DefaultGateway) {
          promises.push(setIPv6DefaultGateway());
        }
        */

        if ($scope.interface.HostName != $scope.dataService.hostname) {
          promises.push(setHostname());
        }
        if ($scope.interface.DHCPv4.DHCPEnabled !=
            $scope.oldInterface.DHCPv4.DHCPEnabled) {
          promises.push(setDHCPEnabled());
        }


        // Set IPV4 IP Addresses, Netmask Prefix Lengths, and Gateways
        $scope.validateIPV4 = $scope.validate();
        if ($scope.validateIPV4 == true) {
          // if ($scope.interface.DHCPv4.DHCPEnabled == false) {
          // IPv4Addresses
          var ipv4Count = Math.max(
              $scope.interface.IPv4Addresses.length,
              $scope.oldInterface.IPv4Addresses.length);

          for (let i = 0; i < ipv4Count; i++) {
            if ($scope.ipv4Update) {
              promises.push(constructIPV4(i));
            };
          }
          if ($scope.ipv4Update) {
            promises.push(finalizeIPV4());
          };
          // };

          // StaticNameServers
          // Compare which is bigger to include all in interation
          var dnsCount = Math.max(
              $scope.interface.StaticNameServers.length,
              $scope.oldInterface.StaticNameServers.length);
          for (let i = 0; i < dnsCount; i++) {
            if ($scope.dnsUpdate) {
              promises.push(constructDNS(i));
            };
          }

          if ($scope.dnsUpdate) {
            promises.push(finalizeDNS());
          };

          if (promises.length) {
            $q.all(promises).then(
                function(response) {
                  toastService.success('Network settings saved');
                  $scope.loading = false;


                  $scope.dnsUpdate = false;
                  $scope.ipv4Update = false;
                  $scope.rowUpdate = false;

                  // update values for oldInterface
                  $scope.oldInterface =
                      JSON.parse(JSON.stringify($scope.interface));
                },
                function(error) {
                  $scope.interface =
                      JSON.parse(JSON.stringify($scope.oldInterface));
                  $scope.loading = false;
                  toastService.error('Network settings could not be saved');
                })
          } else {
            $scope.loading = false;
          }
        };
      };

      function setMACAddress() {
        return APIUtils
            .setMACAddress(
                $scope.selectedInterface, $scope.interface.MACAddress)
            .then(
                function(data) {

                },
                function(error) {
                  console.log(JSON.stringify(error));
                  return $q.reject();
                });
      };

      function setIPv6DefaultGateway() {
        return APIUtils
            .setIPv6DefaultGateway(
                $scope.selectedInterface, $scope.interface.IPv6DefaultGateway)
            .then(
                function(data) {},
                function(error) {
                  console.log(JSON.stringify(error));
                  return $q.reject();
                });
      };

      function setHostname() {
        return APIUtils
            .setHostname($scope.selectedInterface, $scope.interface.HostName)
            .then(
                function(data) {},
                function(error) {
                  console.log(JSON.stringify(error));
                  return $q.reject();
                });
      };

      function setDHCPEnabled() {
        return APIUtils
            .setDHCPEnabled(
                $scope.selectedInterface, $scope.interface.DHCPv4.DHCPEnabled)
            .then(
                function(data) {},
                function(error) {
                  console.log(JSON.stringify(error));
                  return $q.reject();
                });
      };
      function constructIPV4(index) {
        if (!$scope.oldInterface.IPv4StaticAddresses[index]) {
          // 1: If new, put on end
          if ($scope.interface.IPv4Addresses[index]) {
            $scope.IPv4AddressesArray.push({
              Address: $scope.interface.IPv4Addresses[index].Address,
              SubnetMask: $scope.interface.IPv4Addresses[index].SubnetMask,
              Gateway: $scope.interface.IPv4Addresses[index].Gateway
            });
          };
        } else if ($scope.removeIPv4Addresses.includes(index)) {
          // 2: If gone, change to null
          $scope.IPv4AddressesArray.push(null);
          // Must duplicate the current item in array to next spot in array
          $scope.interface.IPv4Addresses.push(
              $scope.interface.IPv4Addresses[index]);
        } else if (
            $scope.interface.IPv4Addresses[index].Address ==
                $scope.oldInterface.IPv4StaticAddresses[index].Address &&
            $scope.interface.IPv4Addresses[index].Gateway ==
                $scope.oldInterface.IPv4StaticAddresses[index].Gateway &&
            $scope.interface.IPv4Addresses[index].SubnetMask ==
                $scope.oldInterface.IPv4StaticAddresses[index].SubnetMask) {
          // 3: If same, make empty array
          $scope.IPv4AddressesArray.push({});
        } else if (
            $scope.interface.IPv4Addresses[index].Address !=
                $scope.oldInterface.IPv4StaticAddresses[index].Address ||
            $scope.interface.IPv4Addresses[index].Gateway !=
                $scope.oldInterface.IPv4StaticAddresses[index].Gateway ||
            $scope.interface.IPv4Addresses[index].SubnetMask !=
                $scope.oldInterface.IPv4StaticAddresses[index].SubnetMask) {
          // 4: If values changed, make original null and add array item on end
          $scope.IPv4AddressesArray.push(null);
          $scope.toAddOnEndofArray.push(index);
        };
      };

      function finalizeIPV4() {
        if ($scope.ipv4Update) {
          for (var i in $scope.toAddOnEndofArray) {
            // Can't use AddressOrigin: Static so build this way
            $scope.IPv4AddressesArray.push({
              Address:
                  $scope.interface.IPv4Addresses[$scope.toAddOnEndofArray[i]]
                      .Address,
              SubnetMask:
                  $scope.interface.IPv4Addresses[$scope.toAddOnEndofArray[i]]
                      .SubnetMask,
              Gateway:
                  $scope.interface.IPv4Addresses[$scope.toAddOnEndofArray[i]]
                      .Gateway
            });
          };
        };
        return APIUtils
            .addIPv4StaticAddress(
                $scope.IPv4AddressesArray, $scope.selectedInterface)
            .then(
                function(data) {
                  $scope.IPv4AddressesArray = [];
                  // Remove from array
                  for (let i = 0; i < $scope.interface.IPv4Addresses.length;
                       i++) {
                    if ($scope.removeIPv4Addresses.includes(i)) {
                      $scope.interface.IPv4Addresses.splice(i, 1)
                    };
                  };
                },
                function(error) {
                  $scope.IPv4AddressesArray = [];
                  console.log(JSON.stringify(error));
                  return $q.reject();
                })
      };

      function constructDNS(index) {
        if (!$scope.oldInterface.StaticNameServers[index]) {
          if ($scope.interface.StaticNameServers[index]) {
            // 1: If new, put on end
            $scope.toAddOnEndofDNSArray.push(index);
          };
        } else if (!$scope.interface.StaticNameServers[index]) {
          // 2: If gone, change to null
        } else if (
            $scope.interface.StaticNameServers[index] ==
            $scope.oldInterface.StaticNameServers[index]) {
          // 3: If same, make empty array
          $scope.dnsServersArray.push(
              $scope.interface.StaticNameServers[index]);
        } else if (
            $scope.interface.StaticNameServers[index] !=
            $scope.oldInterface.StaticNameServers[index]) {
          // 4: If values changed, make original null and add new array item
          // on end
          $scope.toAddOnEndofDNSArray.push(index);
        };
      };

      function finalizeDNS() {
        if ($scope.dnsUpdate) {
          for (var i in $scope.toAddOnEndofDNSArray) {
            $scope.dnsServersArray.splice(
                ($scope.dnsServersArray.length), 0,
                $scope.interface.StaticNameServers
                    [$scope.toAddOnEndofDNSArray[i]])
          };

          return APIUtils
              .setNameservers($scope.dnsServersArray, $scope.selectedInterface)
              .then(
                  function(data) {
                    $scope.dnsServersArray = [];
                  },
                  function(error) {
                    $scope.dnsServersArray = [];
                    console.log(JSON.stringify(error));
                    return $q.reject();
                  })
        };
      };

      $scope.refresh = function() {
        $scope.interface = $scope.oldInterface;
      };

      $scope.selectInterface = function(val) {
        $scope.filterById = val;

        $scope.interface = $filter('filter')($scope.eth, $scope.filterById);
        $scope.interface = $scope.interface[0];

        $scope.oldInterface = JSON.parse(JSON.stringify($scope.interface));
      };

      function loadNetworkInfo() {
        APIUtils.getNetworkInfo().then(function(data) {
          $scope.eth = data;
          if ($scope.eth[0].Id.length) {
            // Use the first network interface if the user hasn't chosen one
            if (!$scope.selectedInterface) {
              $scope.selectedInterface = $scope.eth[0].Id;
              $scope.filterById = $scope.selectedInterface;
              $scope.interface =
                  $filter('filter')($scope.eth, $scope.filterById);
              $scope.interface = $scope.interface[0];
            }

            // Copy the interface so we know later if changes were made to the
            // page
            $scope.oldInterface = JSON.parse(JSON.stringify($scope.interface));

            $scope.loading = false;
          };
        });
      };
    }
  ]);
})(angular);