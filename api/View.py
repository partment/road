# -*- coding: UTF-8 -*-

import Config

import json
#Need to install https://pypi.org/project/mariadb/
import mariadb
import datetime
import re
import os

from flask_caching import Cache
from flask import Flask, Response, jsonify, render_template, request, send_from_directory

#Replace configs with envs
if os.getenv('RD_DB_HOST') != None : Config.db_host = os.getenv('RD_DB_HOST')
if os.getenv('RD_DB_USER') != None : Config.db_user = os.getenv('RD_DB_USER')
if os.getenv('RD_DB_PASSWORD') != None : Config.db_password = os.getenv('RD_DB_PASSWORD')
if os.getenv('RD_DB_DATABASE') != None : Config.db_database = os.getenv('RD_DB_DATABASE')
if os.getenv('RD_IMG_PATH') != None : Config.defects_img_path = os.getenv('RD_IMG_PATH')
if os.getenv('RD_LAST_DAYS') != None :
    try:
        Config.last_days = int(os.getenv('RD_LAST_DAYS'))
    except:
        print("Env RD_LAST_DAYS is not an integer, rollback to default.")
if os.getenv('RD_DOMAIN') != None : Config.domain = os.getenv('RD_DOMAIN')


app = Flask(__name__, template_folder='templates', static_url_path='', static_folder='templates')
config = {
    'CACHE_TYPE': 'filesystem',
    'CACHE_DIR': './flask_cache',
    'CACHE_DEFAULT_TIMEOUT': 30,
    'JSON_AS_ASCII': False #Disable ASCII to satisfy chinese compatibility
}

app.config.from_mapping(config)
#Enable Cache in order to reduce database load
cache = Cache(app)

@app.route("/", methods=['GET'])
def index():
    return render_template('index.html')

@app.route("/assets/js/index.js", methods=['GET'])
def indexjs():
    return render_template('assets/js/index.js', Config=Config)

@app.route('/v1/get/img/<path:filename>')
def send_img(filename):
    return send_from_directory(Config.defects_img_path, filename, as_attachment=False)

@app.route('/v1/get/defects', methods=['GET'])
def defects():

    conn = connect_mysql()
    cursor = conn.cursor()

    # Following regexps are meant to prevent unexpected requests or attacks
    # ^(D\d{2})(,D\d{2})*$ CHECKS IF args.type FOLLOWS THE PATTERN D01,D02,D03 ...
    # ^(\d+|null)(,(\d+|null))*$ CHECKS IF args.dist FOLLOWS THE PATTERN null,1,12,123,null,1234,12345,54321 ...
    # ^([\u4E00-\u9FFF]+)(,[\u4E00-\u9FFF]+)*$ CHECKS IF args.road FOLLOWS THE PATTERN 測試一路,測試二路 ...
    # ^(((19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))(\~)?(,?((19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))*$ CHECKS IF args.date FOLLOWS THE PATTERN 2020-12-31,2020-01-01 or 2020-12-31~2020-01-01,2021-04-01...

    distreg = '^(\d+|null)(,(\d+|null))*$'
    roadreg = '^([\u4E00-\u9FFF]+)(,[\u4E00-\u9FFF]+)*$'
    datereg = '^(((19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))(\~)?(,?((19|20)\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))*$'
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
        cursor.execute('select markdate, GPS_x, GPS_y, photo_loc, markid, road_name, seq_id from recv order by seq_id')
    else:
        cursor.execute('select markdate, GPS_x, GPS_y, photo_loc, markid, road_name, seq_id from recv where {} order by seq_id'.format(clause))

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
    resp.headers['Access-Control-Allow-Origin'] = 'https://'+Config.domain
    resp.headers['Vary'] = 'Origin'

    conn.close()

    return resp

#Return dist data
@app.route('/v1/get/dists', methods=['GET'])
@cache.cached(timeout=3600)
def dicts():

    conn = connect_mysql()
    cursor = conn.cursor()

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
    #Allow cross domain api access
    resp.headers['Access-Control-Allow-Origin'] = 'https://'+Config.domain
    resp.headers['Vary'] = 'Origin'

    conn.close()

    return resp

#Write Alignment to Database
@app.route('/v1/post/advice', methods=['POST'])
def advice():

    seqreg = '^\d+$'
    typereg = '^(D\d{2})$'

    (req_id, markid) = (request.values.get('seq_id'), request.values.get('markid'))

    req_id = req_id if req_id != None and re.match(seqreg, req_id) else ''
    markid = markid if markid != None and re.match(typereg, markid) else ''

    response = {}
    
    if req_id != '' and markid != '':
        conn = connect_mysql()
        cursor = conn.cursor()

        sql = 'insert into `Alignments` (`seq_id`, `markid`, `time`) VALUES (%d, %s, %s)'
        val = (req_id, markid, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        try:
            cursor.execute(sql, val)
            conn.commit()
            if cursor.rowcount > 0:
                response = {"code": 200, "status": "success"}
            else:
                response = {"code": 200, "status": "fail"}
        except mariadb.Error as e:
            print(f"Error: {e}")
            response = {"code": 200, "status": "fail"}
        finally:
            conn.close()

    resp = jsonify(response)
    #Allow cross domain api access
    resp.headers['Access-Control-Allow-Origin'] = 'https://'+Config.domain
    resp.headers['Vary'] = 'Origin'

    return resp

#Filter data to mysql clause conversion
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
                if conditions['dist_id'][i] == 'null':
                    temp += '(dist_id is null'
                else:
                    temp += '(dist_id = "{}"'.format(conditions['dist_id'][i])
            else:
                if conditions['dist_id'][i] == 'null':
                    temp += ' or dist_id is null'.format(conditions['dist_id'][i])
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
                if '~' in conditions['markdate'][i]:
                    (date1, date2) = conditions['markdate'][i].split('~', 1)
                    temp += '(markdate between "{}"and "{}"'.format(date1, date2)
                else:
                    temp += '(markdate = "{}"'.format(conditions['markdate'][i])
            else:
                if '~' in conditions['markdate'][i]:
                    (date1, date2) = conditions['markdate'][i].split('~', 1)
                    temp += 'or markdate between "{}"and "{}"'.format(date1, date2)
                else:
                    temp += ' or markdate = "{}"'.format(conditions['markdate'][i])
        temp += ')'
        result += temp
    else:
        if result != '': result += ' and '
        #Last X days data
        today = datetime.date.today()
        past = today - datetime.timedelta(days=Config.last_days)
        result += ('markdate between "{}"and "{}"'.format(past, today))
    #DEFECT TYPE
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

def connect_mysql():
    return mariadb.connect(
        host = Config.db_host,
        user = Config.db_user,
        password = Config.db_password,
        database = Config.db_database
    )

if __name__ == "__main__":
    app.run(debug=True)