# Foreman API

Unauthenticated Endpoints 
-------------------------

## GET `/api/queue`
Get all keybags in the decryption queue.
```
curl -i -H "Accept: application/json" https://foreman-public.sudosecuritygroup.com/api/queue
```

## GET `/api/find/all`
Get all available keys in the Foreman keystore. 
```
curl -i -H "Accept: application/json" https://foreman-public.sudosecuritygroup.com/api/find/all
```

## GET `/api/find/build/:buildnumber`
Get all keys for a specific iOS build number, ex. 17A860.
```
curl -i -H "Accept: application/json" https://foreman-public.sudosecuritygroup.com/api/find/build/17A860
```

## GET `/api/find/device/:device`
Get all keys for a specific device model, ex. iPod9,1
```
curl -i -H "Accept: application/json" https://foreman-public.sudosecuritygroup.com/api/find/device/iPod9,1/
```

## GET `/api/find/combo/:device/:build`
Get all keys for a specific device model, ex. iPod9,1 and build number ex. 17A860
```
curl -i -H "Accept: application/json" https://foreman-public.sudosecuritygroup.com/api/find/combo/iPod9,1/17A860
```

Authenticated Endpoints
-----------------------

### `NoAuth` Mode Operation
Adding `FOREMAN_FORCE_NOAUTH=true` to your `.env.` configuration will flag the following endpoints to accept any token, making them essentially unauthenticated. *A token and the User-Agent must be present in the request but the token can be set to anything*.

## POST `/api/submit/keys`
Submit a grandmaster `gm.config` file to be archived in the keystore.

Requires that the User-Agent be set to include `grandmaster` along with `x-api-key` being set to an authorized Foreman API token in the request header.
```
curl -d '{"build":"17B111","device":"iPod9,1","download":"http://updates-http.cdn-apple.com/2019FallFCS/fullrestores/061-49700/BD7C17D0-0696-11EA-970C-D191B09E16A9/iPodtouch_7_13.2.3_17B111_Restore.ipsw","images":{"Firmware/all_flash/DeviceTree.n112ap.im4p":"","Firmware/all_flash/LLB.n112.RELEASE.im4p":"85784a219eb29bcb1cc862de00a590e7f539c51a7f3403d90c9bdc62490f6b5dab4318f4633269ce3fbbe855b33a4bc7","Firmware/all_flash/iBoot.n112.RELEASE.im4p":"052e13cf2bb7802ba9d1a27046b9f9cf325d957388cd1a4325d114a5b2524391b48111c6d9768ceb29bf0b28bd21ff5c","Firmware/dfu/iBEC.n112.RELEASE.im4p":"9f2f0a3df25594d781052202e09d1a47d4211e5b5864850ee76b0dac53f785148652c17000c5e57b9e2c57040adf2c8e","Firmware/dfu/iBSS.n112.RELEASE.im4p":"e096697bb5ce030cfbe004961dde7f50e384e198e50f1e13ca532016506d71ee176ea87384e3c9e04c9afa7231dbcb4d"},"iosver":"13.2.3","kbags":{"Firmware/all_flash/LLB.n112.RELEASE.im4p":["DEBD6EDC7308203646AE11D4A114E725CF9A1501492B67FDADE7CD7C8A21DA752F0B7D07D6C4F1E90EF8AB10B1EC0215","B15052EB57FA9C6C31E5F0BB67D2B2FE90FD5571DFB8C4F3558B4A6B26FAE4BA3E2333DE4F703F91C0D186F1CE1413B6"],"Firmware/all_flash/iBoot.n112.RELEASE.im4p":["B35F7F51964476895D6B2B5F0015D299CAE2E1A75D7AD664E948E77ACAD52BC785AFDA14307C440B49C0BDAD398B2331","B5BDA4BA78E0E8E99DD74494A613AF7B255E2AA6AF6C21711C8FB7AF8D3BAE95B135585C52EBA1A8A47C1FDFB9ACE8D4"],"Firmware/dfu/iBEC.n112.RELEASE.im4p":["AE4CE9EB184640E992CA576CCCCA8AC4FDB9AD30A1DC07B82175AEAD797F01399947056E6210B61AD1A1AF54084F0D07","9804C011D723156CDA3D5FC96A13015065B1D51203042AE77F2121E9AD7F256A2643DF87057450D90D938A79CF5C4905"],"Firmware/dfu/iBSS.n112.RELEASE.im4p":["FC2F689BBEA2DEA65014931DE81AA985B814A7B0188E50B2DD6A5E37C7E8523150A9E551E1D578D25C96D5FE859FDF74","73CE12C73B2971B412AF50CFFA11DA543AE885AA72336196A78287FA3901D844649F5B66301269A6CBF5596716AE5852"]}}' -H "Content-Type: application/json" -H "x-api-key: GENERATED_TOKEN" -A "grandmaster/0.0.1" -X POST https://foreman-public.sudosecuritygroup.com/api/submit/keys
```

## POST `/api/submit/keybags`
Submit an unfinished grandmaster `gm.config` file to be added to the keybag decryption queue.

Requires that the User-Agent be set to include `grandmaster` along with `x-api-key` being set to an authorized Foreman API token in the request header.
```
curl -d '{"build":"17B111","device":"iPod9,1","download":"http://updates-http.cdn-apple.com/2019FallFCS/fullrestores/061-49700/BD7C17D0-0696-11EA-970C-D191B09E16A9/iPodtouch_7_13.2.3_17B111_Restore.ipsw","images":{"Firmware/all_flash/LLB.n112.RELEASE.im4p":"85784a219eb29bcb1cc862de00a590e7f539c51a7f3403d90c9bdc62490f6b5dab4318f4633269ce3fbbe855b33a4bc7","Firmware/all_flash/iBoot.n112.RELEASE.im4p":"052e13cf2bb7802ba9d1a27046b9f9cf325d957388cd1a4325d114a5b2524391b48111c6d9768ceb29bf0b28bd21ff5c","Firmware/dfu/iBEC.n112.RELEASE.im4p":"9f2f0a3df25594d781052202e09d1a47d4211e5b5864850ee76b0dac53f785148652c17000c5e57b9e2c57040adf2c8e","Firmware/dfu/iBSS.n112.RELEASE.im4p":"e096697bb5ce030cfbe004961dde7f50e384e198e50f1e13ca532016506d71ee176ea87384e3c9e04c9afa7231dbcb4d"},"iosver":"13.2.3","kbags":{"Firmware/all_flash/LLB.n112.RELEASE.im4p":[],"Firmware/all_flash/iBoot.n112.RELEASE.im4p":[],"Firmware/dfu/iBEC.n112.RELEASE.im4p":[],"Firmware/dfu/iBSS.n112.RELEASE.im4p":[]}}' -H "Content-Type: application/json" -H "x-api-key: GENERATED_TOKEN" -A "grandmaster/0.0.1" -X POST https://foreman-public.sudosecuritygroup.com/api/submit/keybags
```