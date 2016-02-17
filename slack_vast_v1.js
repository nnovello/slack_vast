/*
Sample ad requests:
http://hls.v.fwmrm.net/ad/g/1?&vip=158.106.192.14&_dv=2&akamaiPlaceholder=true&caid=bein-sports-hd-spanish&csid=fubotv_desktop_bein-sports-hd-spanish&flag=%2Bsltp%2Bexvt%2Brema%2Bslcb%2Baeti%2Bproxy&mode=live&nw=393637&prof=393637:fubo_desktop_test&pvrn=34464&resp=vast2&vdur=100&vprn=47399&vip=158.106.192.14&_ak_ads_sessionid=cb8eb2e&_ak_ads_requestid=cb8ed08;&;ptgt=a&slid=seq_101876&envp=393637:fubo_desktop_test&w=0&h=0&lo=&maxd=98&tpos=0&tpcl=midroll&cpsq=1&slau=
http://pubads.g.doubleclick.net/gampad/ads?slotname=/3824/AMCTVE/DTV&sz=640x480&ciu_szs=300x250&cust_params=pos%3Dvideo&url=http://www.amctv.com&unviewed_position_start=1&output=xml_vast3&impl=s&env=vp&gdfp_req=1&ad_rule=0&video_url_to_fetch=http://www.amctv.com&vad_type=linear&vpos=preroll&pod=1&min_ad_duration=0&max_ad_duration=39000&ppos=1&lip=true&correlator=4306271883690084&scor=1329165368295424&video_doc_id=AMC_CBM_401_DAI&cmsid=3801
*/

//Node Packages
var express = require('express');
var bodyParser = require('body-parser');
var ad_request = require('request');
var slack_post = require('request');
var xml_parser = require('xml2js').parseString;

//create express app
var app = express();
app.use(bodyParser.urlencoded());

//define slack_params
//  [0] = Ad request
//  [1] = Number of requests to send
var slack_params;
//Define a GLOBAL vast_request URL
var vast_url;
//Define a GLOBAL # requests
var number_requests;

// ~~~~~~~~~~~~~~~~~~~~~~~~~ SLACK POST HANDLER  ~~~~~~~~~~~~~~~~~~~~~~~~~ 
app.post('/', function(req, res) {  
  //Print full BODY for DEBUG
  //console.log(req.body);
  var slack_post_url = req.body.response_url;
  
  //Slack request body parse
  slack_params = req.body.text.split(" ");
  vast_url = slack_params[0];
  number_requests = slack_params[1];
  
  //Slack User specified valid URL ?
  if ( (vast_url.search('.com') > -1) || (vast_url.search('.net') > -1) || (vast_url.search('.tv') > -1) ) {
  
    //check for 'http' at beginning of string, handles request errors
    if (vast_url.search('http://') > -1){
      //Full url, ok
    } 
    else {
      vast_url = 'http://' + vast_url;
    }
    
    //check if #requests param is a valid , otherwise default to 1
    if (isNaN(number_requests) ) {
      number_requests = 1;
    } else{
       // number passed ok
    }
    
    //Server Log Opening Message
    console.log('Incoming Request to: ' + vast_url + ' , ' + number_requests + ' time(s)');
  
    //Slack Opening Message
    res.write('Firing request ' + number_requests + ' time(s) to: \n' );
    res.write(vast_url + '\n'); 
    res.end();
    
    //Initiate server ad request(s), Loop through # requests
    for (var i=0; i< number_requests; i++) {
      
      var vastVersion;
      var adTitle;
      var adId;
  
      //set GET options
      var options = {
          url: vast_url,
          headers: {
            'User-Agent': 'ipad'
            }
      };
      //Ad Request Function
      function parseAd(error, response, body) {
        console.log("\nRequest Response ContentType: ");
        console.log(response.caseless.dict['content-type']);
          if (!error && response.statusCode == 200 && response.caseless.dict['content-type'] == 'text/xml') {
            console.log('\nAd Request returned code: ' + response.statusCode + '\n');
            //console.log(response.body + '\n');  //print xml response
  
            //Parse XML
            xml_parser(response.body,{trim: true, explicitArray: true, attrkey: 'WRAPPER'}, function(err,result) {
   
            //VAST Check // Build V3/VMAP check!
            if (result.VAST.WRAPPER["version"] !== 'undefined'){
              adVersion = result.VAST.WRAPPER["version"];
              console.log('Ad Version detected: ');
              console.log(adVersion);
            }
            //Ad Title Check
            if (typeof result.VAST.Ad[0].InLine[0].AdTitle[0] !== 'undefined'){
              adTitle = (result.VAST.Ad[0].InLine[0].AdTitle[0]);
              console.log('AdTitle detected: ');
              console.log(adTitle);
            }
            //Ad ID Check
            if (result.VAST.Ad[0].InLine[0].Creatives[0].Creative[0].WRAPPER.hasOwnProperty("AdID")) {
              adId = result.VAST.Ad[0].InLine[0].Creatives[0].Creative[0].WRAPPER["AdID"];
              console.log('AdID detected: ');
              console.log(adId);
            } 
        
            console.log('\n');
            
            //POST resuts back to Slack
            adInfo = ("VAST: " + adVersion + ", Placement : " + adTitle + ", AdID: " + adId); 
            
            var slack_form = {
              "response_type": "ephemeral",
              "attachments": [ 
                  {
                    "text": adInfo,
                  }
                ]
            };
  
            //set POST options
            var post_options = {
              url: slack_post_url,
              method: "POST",
              headers: {
                'User-Agent': 'request',
                'Content-Type': 'application/json'
                },
              json: slack_form
            };
  
            function slackCallback(error, response, body) {
              console.log('Slack Message Sent with Status: ')
              console.log(response.statusCode);
            }
            
            //Fire Post
            slack_post.post(post_options, slackCallback);
            });
            
            
          } else {//Log VAST Request Error
            console.log('Ad Request returned an error ');
          }
        }
        
      //Fire and Parse Request
      ad_request.get(options,parseAd);
  
  //end looping through requests
    }
  
  // END Session if Invalid Request
  } else {
    console.log('Invalid Request URL: ' + vast_url);
    res.write('Invalid Request URL: \n');
    res.write(vast_url + '\n');
    res.end()
  }
});  //~~~~~~~~~~~~~~~~~~~ END SLACK POST HANDLER ~~~~~~~~~~~~~~~~~~~~~~~~~


//Start Server
app.listen(process.env.PORT, process.env.IP, function () {
  console.log('App listening on' + ' ' + process.env.IP + ':' + process.env.PORT);
});
