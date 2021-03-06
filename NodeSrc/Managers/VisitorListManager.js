/**
 * Copyright - A Produle Systems Private Limited. All Rights Reserved.
 *
 * @desc Handles all the Visitor List related operations
 *
 */

var express = require("express");
var app = require("../server").app;
var moment = require("moment");

class VisitorListManager {

  constructor()
    {

        this.router = express.Router();


        this.router.post("/visitorlist",(req, res) => { this.getAllVisitors(req,res); });
        this.router.post("/getvisitordetails",(req, res) => { this.getVisitorById(req,res); });
        this.router.post("/getvisitormessages",(req, res) => { this.getVisitorMessages(req,res); });
        this.router.post("/getvisitorsessions",(req, res) => { this.getVisitorSessions(req,res); });
        this.router.post("/getfieldslist",(req, res) => { this.getFieldsList(req,res); });
    }

  	/*
  	 * @desc Returns all visitors of the app
  	 */
  	getAllVisitors(req,res)
  	{
        if(!req.isAuthenticated())
        {
            return res.send({status:'authenticationfailed'});
        }

        var appId = req.body.appid;
        var skipIndex = req.body.skipindex;
        var pageLimit = req.body.pagelimit;
        var filterId = req.body.filterid;
        var sortColumn = req.body.sortColumn;
        var sortOrder = req.body.sortOrder;
        var mongoFilterQuery = JSON.parse(req.body.mongoFilterQuery);

        if(mongoFilterQuery == null)
        {
            this.getFilterData(appId,filterId,sortColumn,sortOrder,skipIndex,pageLimit,[],function(response,totalcount){
                return res.send({status:response,totalcount:totalcount});
            });
        }
        else
        {
            this.getAllVisitorsFromDB(appId,mongoFilterQuery,sortColumn,sortOrder,skipIndex,pageLimit,[],function(response,totalcount){
                return res.send({status:response,totalcount:totalcount});
            });
        }

  	}

  	/*
  	 * @desc Returns all visitors of the app
  	 */
  	getFilterData(appId,filterId,sortColumn,sortOrder,skipIndex,pageLimit,exclusionList,callback)
  	{
        var filter = global.db.collection('filters').findOne(

            {_id:filterId},

            function(err,filter)
            {
                var filterQuery = JSON.parse(filter.mongoFilter);

                if(filterId == "2")
                {
                    var date30DaysAgo = new Date(moment( moment().subtract(30, 'days') ).format("YYYY-MM-DDTHH:mm:ss.SSSZ"));
                    filterQuery = {"visitorMetaInfo.firstSeen" : {"$gte":date30DaysAgo }};
                }

                if(filterId == "3")
                {
                    var date30DaysAgo = new Date(moment( moment().subtract(30, 'days') ).format("YYYY-MM-DDTHH:mm:ss.SSSZ"));
                    filterQuery = {"visitorMetaInfo.lastSeen" : {"$lte":date30DaysAgo }};
                }

                var VisitorListManagerObj = new VisitorListManager();
                VisitorListManagerObj.getAllVisitorsFromDB(appId,filterQuery,sortColumn,sortOrder,skipIndex,pageLimit,exclusionList,callback);
            }
        );


  	}

  	/*
  	 * @desc Returns all visitors of the app
  	 */
  	getAllVisitorsFromDB(appId,filterQuery,sortColumn,sortOrder,skipIndex,pageLimit,exclusionList,callback)
  	{
        var sortQuery = JSON.parse('{"'+sortColumn+'":'+sortOrder+'}');

        var aggregateArray = [
            { $skip : skipIndex },
            {
              $lookup:
                {
                  from: "sessions",
                  localField: "_id",
                  foreignField: "visitorId",
                  as: "sessions"
                }
            },
            { $sort :
                sortQuery
            },
            { $match :
                { "$and": [
                    {
                      appId:appId
                    },
                    { _id: {"$nin": exclusionList}},
                    filterQuery
                  ]
                }
            }
        ];

        var aggregateWithLimit = aggregateArray;
        var aggregateWithCount = aggregateArray;

        if(pageLimit != null)
        {
            aggregateWithLimit.push({ $limit : pageLimit });
        }

        var visitorCollection = global.db.collection('visitors').aggregate(aggregateWithLimit).toArray(function(err,visitors)
            {
                if(err)
                {
                    callback('failure');
                }
                else
                {
                    aggregateWithCount.push({$count: "count"});

                    var visitorRecordCollection = global.db.collection('visitors').aggregate(aggregateWithCount).toArray(function(err,totalcount)
                        {
                            if(err)
                            {
                                callback('failure');
                            }
                            else
                            {
                                callback(visitors,totalcount);
                            }
                        }
                    );
                }
            }
        );


  	}

  	/*
  	 * @desc Return data of visitor by ID
  	 */
  	getVisitorById(req,res)
  	{

        if(!req.isAuthenticated())
        {
            return res.send({status:'authenticationfailed'});
        }

        var visitorId = req.body.visitorId;
        if(visitorId)
    	{

            var visitorCollection = global.db.collection('visitors').aggregate([
                { $match :
                    { _id: visitorId }
                },
                {
                  $lookup:
                    {
                      from: "sessions",
                      localField: "_id",
                      foreignField: "visitorId",
                      as: "sessions"
                    }
                }
            ]).toArray(function(err,visitor)
                {
                    if(err)
                    {
                        return res.send({status:'failure'});
                    }
                    else
                    {
                        return res.send({status:'success',visitor:visitor[0]});
                    }
                }
            );

    	}

  	}

  	/*
  	 * @desc Return collection of messages sento a visitor
  	 */
  	getVisitorMessages(req,res)
  	{
        if(!req.isAuthenticated())
        {
            return res.send({status:'authenticationfailed'});
        }

        var visitorId = req.body.visitorId;
        if(visitorId)
    	{

            var messagesCollection = global.db.collection('messages').aggregate([
                { $match :
                    { visitorId: visitorId }
                }
            ]).toArray(function(err,messages)
                {
                    if(err)
                    {
                        return res.send({status:'failure'});
                    }
                    else
                    {
                        return res.send({status:'success',messages:messages});
                    }
                }
            );

    	}

  	}
  	
  	/*
  	 * @desc Return collection of visitor sessions datas
  	 */
  	getVisitorSessions(req,res)
  	{
        if(!req.isAuthenticated())
        {
            return res.send({status:'authenticationfailed'});
        }

        var visitorId = req.body.visitorId;
        var skipIndex = req.body.skipindex;
        var pageLimit = req.body.pagelimit; 
        
        if(visitorId)
    	{ 
            var messagesCollection = global.db.collection('visitorevents').aggregate([
                 { $match : { visitorId: visitorId } },
                 { $skip : skipIndex },
                 { $lookup:
                 {
                   from: "sessions",
                   localField: "sessionId",
                   foreignField: "_id",
                   as: "sessions"
                 }
                 },
                 { $limit : pageLimit }
            ]).toArray(function(err,sessions)
                {
                    if(err)
                    {
                        return res.send({status:'failure'});
                    }
                    else
                    {
                        return res.send({status:'success',sessions:sessions});
                    }
                }
            );

    	}

  	}  
  	

  	/*
  	 * @desc Return list of fields available for the app
  	 */
  	getFieldsList(req,res)
  	{
        if(!req.isAuthenticated())
        {
            return res.send({status:'authenticationfailed'});
        }

        var appId = req.body.appid;
        if(appId)
    	{

            var visitorsCollection = global.db.collection('visitors').aggregate([
                { $match :
                    { appId: appId }
                },
                { $limit : 1 }
            ]).toArray(function(err,visitors)
                {
                    if(err)
                    {
                        return res.send({status:'failure'});
                    }
                    else if(visitors.length > 0)
                    {
                        var fieldList = [];
                        for (var fieldSingle in visitors[0].visitorData)
                        {
                            fieldList.push(fieldSingle);
                        }
                        return res.send({status:'success',fields:fieldList});
                    }
                    else
                    {
                        return res.send({status:'success',fields:[]});
                    }
                }
            );
    	}

  	}
}


module.exports.VisitorListManager = VisitorListManager;
