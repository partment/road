# -*- coding: UTF-8 -*-

import Config

import json
import mariadb
import datetime
import re
from flask import Flask, Response, jsonify, request

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

conn = mariadb.connect(
    host = Config.db_host,
    user = Config.db_user,
    password = Config.db_password,
    database = Config.db_database
)

cursor = conn.cursor()

"""@app.route('/v1/get/defects/today', methods=['GET'])
def defects_all():
    date = datetime.date.today()
    date = date.isoformat()

    #cursor.execute('select markdate, GPS_x, GPS_y, photo_loc, markid from recv where markdate = "{}"'.format(date))
    cursor.execute('select markdate, GPS_x, GPS_y, photo_loc, markid from recv')
    result = cursor.fetchall()
    response = {"defects": []}
    
    for i in range(len(result)):
        data = {
            "markdate": result[i][0].strftime('%Y-%m-%d'),
            "GPS_x": result[i][1],
            "GPS_y": result[i][2],
            "photo_loc": result[i][3],
            "markid": result[i][4]
        }
        response["defects"].append(data)

    return jsonify(response)"""

@app.route('/v1/get/defects', methods=['GET'])
def defects():

    # Following regexps are meant to prevent unexpected requests or attacks
    # ^(D\d{2})(,D\d{2})*$ CHECKS IF args.type FOLLOWS THE PATTERN D01,D02,D03 ...
    # ^(\d+)(,\d+)*$ CHECKS IF args.dist FOLLOWS THE PATTERN 1,12,123,1234,12345,54321 ...
    # ^([\u4E00-\u9FFF]+)(,[\u4E00-\u9FFF]+)*$ CHECKS IF args.road FOLLOWS THE PATTERN 測試一路,測試二路 ...
    # ^(((19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))(,((19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))*$ CHECKS IF args.date FOLLOWS THE PATTERN 2020-12-31,2020-01-01 ...

    distreg = '^(\d+)(,\d+)*$'
    roadreg = '^([\u4E00-\u9FFF]+)(,[\u4E00-\u9FFF]+)*$'
    datereg = '^(((19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))(,((19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))*$'
    typereg = '^(D\d{2})(,D\d{2})*$'

    # Slice args into conditions by ","
    dists = request.args.get('dist').split(',') if request.args.get('dist') != None and re.match(distreg, request.args.get('dist')) else []
    roads = request.args.get('road').split(',') if request.args.get('road') != None and re.match(roadreg, request.args.get('road')) else []
    dates = request.args.get('date').split(',') if request.args.get('date') != None and re.match(datereg, request.args.get('date')) else []
    types = request.args.get('type').split(',') if request.args.get('type') != None and re.match(typereg, request.args.get('type')) else []

    conditions = {
        'dist_id': dists,
        'road_name': roads,
        'markdate': dates,
        'markid': types
    }

    # Transform into sql clause at where
    clause = getWhereClause(conditions)

    if clause == '':
        #return jsonify({'code': 0, 'msg': 'No conditions nor properly arguments are requested.'})
        cursor.execute('select markdate, GPS_x, GPS_y, photo_loc, markid, road_name, seq_id from recv order by seq_id'.format(clause))
    else:
        cursor.execute('select markdate, GPS_x, GPS_y, photo_loc, markid, road_name, seq_id from recv where {} order by seq_id'.format(clause))

    #cursor.execute('select markdate, GPS_x, GPS_y, photo_loc, markid, road_name, seq_id from recv where {} order by seq_id'.format(clause))
    result = cursor.fetchall()
    response = {"defects": []}

    for i in range(len(result)):
        data = {
            "seq_id": result[i][6],
            "markdate": result[i][0].strftime('%Y-%m-%d'),
            "GPS_x": result[i][1],
            "GPS_y": result[i][2],
            "photo_loc": result[i][3],
            "markid": result[i][4],
            "road_name": result[i][5]
        }
        response["defects"].append(data)

    resp = jsonify(response)
    resp.headers['Access-Control-Allow-Origin'] = '*'

    return resp

@app.route('/v1/get/dists', methods=['GET'])
def dicts():
    cursor.execute('select dist_id, dist_name from dist order by dist_id')
    result = cursor.fetchall()
    response = {"dists": []}

    for i in range(len(result)):
        data = {
            "dist_id": result[i][0],
            "dist_name": result[i][1]
        }
        response["dists"].append(data)

    resp = jsonify(response)
    resp.headers['Access-Control-Allow-Origin'] = '*'

    return resp

def getWhereClause(conditions):

    # This function works like this
    # (
    # (dist_id="000"
    # (dist_id="000" or dist_id="111"
    # (dist_id="000" or dist_id="111")
    # (dist_id="000" or dist_id="111") and (
    # So on...

    result = ''
    temp = ''
    #DIST
    if len(conditions['dist_id']) > 0:
        temp = ''
        if result != '': result += ' and '
        for i in range(len(conditions['dist_id'])):
            if i == 0:
                temp += '(dist_id = "{}"'.format(conditions['dist_id'][i])
            else:
                temp += ' or dist_id = "{}"'.format(conditions['dist_id'][i])
        temp += ')'
        result += temp
    #ROAD
    if len(conditions['road_name']) > 0:
        temp = ''
        if result != '': result += ' and '
        for i in range(len(conditions['road_name'])):
            if i == 0:
                temp += '(road_name = "{}"'.format(conditions['road_name'][i])
            else:
                temp += ' or road_name = "{}"'.format(conditions['road_name'][i])
        temp += ')'
        result += temp
    #DATE
    if len(conditions['markdate']) > 0:
        temp = ''
        if result != '': result += ' and '
        for i in range(len(conditions['markdate'])):
            if i == 0:
                temp += '(markdate = "{}"'.format(conditions['markdate'][i])
            else:
                temp += ' or markdate = "{}"'.format(conditions['markdate'][i])
        temp += ')'
        result += temp
    #DATE
    if len(conditions['markid']) > 0:
        temp = ''
        if result != '': result += ' and '
        for i in range(len(conditions['markid'])):
            if i == 0:
                temp += '(markid = "{}"'.format(conditions['markid'][i])
            else:
                temp += ' or markid = "{}"'.format(conditions['markid'][i])
        temp += ')'
        result += temp
    return result

if __name__ == "__main__":
    app.run(debug=True)