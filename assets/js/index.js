document.addEventListener('DOMContentLoaded', () => {
    //Set API Source
    let api = 'https://roadapi.lilithraws.cf';

    //Initial Google Map
    let map;

    //Initial Defects Name
    let defectsname = {
        'D00': '縱向裂縫輪痕',
        'D01': '縱向裂縫施工',
        'D10': '橫向裂縫間隔',
        'D11': '橫向裂縫施工',
        'D20': '龜裂',
        'D21': '人孔破損',
        'D30': '人孔缺失',
        'D31': '路面隆起',
        'D40': '坑洞',
        'D41': '人孔高差',
        'D42': '薄層剝離'
    };

    //Initial Date Picker
    $('[data-toggle="datepicker"]').datepicker({
        language: 'zh-TW',
        autoHide:true,
        format:'yyyy-mm-dd',
        formatted:true,
        endDate:Date()
    });

    //Initial Data Arrays
    let types = JSON.parse(localStorage.getItem('types')) || [];
    let dists = JSON.parse(localStorage.getItem('dists')) || [];
    let dates = JSON.parse(localStorage.getItem('dates')) || [];
    let roads = JSON.parse(localStorage.getItem('roads')) || [];

    //UI Elements
    let toggleshape = document.querySelector('.toggle');
    let toggle = document.querySelector('.toggle input');
    let togglenoti = document.querySelector('.toggle-noti');
    let title = document.querySelector('.title');
    let menucontainer = document.querySelector('.menucontainer');
    let menumore = document.querySelector('.menucontainer .more');
    let alltype = document.querySelectorAll('.type:not(.all)');
    let typeall = document.querySelector('.type.all');
    let adddate = document.querySelector('.adddate');
    let adddist = document.querySelector('.adddist');
    let addmachi = document.querySelector('.addmachi');
    let closewindow = document.querySelector('.detail .window .close');

    let dist = document.querySelector('.dist');

    //Global Logics
    let choosed = false;

    //Initial Dist List
    let distsdata = getDist(api);
    distsdata.then(data => {
        data['dists'].forEach(e => {
            dist.insertAdjacentHTML('beforeend', `<option value="${e['dist_id']}">${e['dist_name']}</option>`);
        });
    }, () => {
        console.log('Server error occured when getting dist\'s infomation.');
    }).finally(() => {
        initDropdownSearch('.dist');
    });

    //Retrive Saved Data
    if(types.length == 0) {
        typeall.checked = true;
    }else {
        typeall.checked = false;
        types.forEach(e => {
            document.querySelector(`.type:not(.all)[data-type="${e}"]`).checked = true;
        })
    }
    updateTag(document.querySelector('.datetags'), dates, 'date');
    updateTag(document.querySelector('.disttags'), dists, 'dist');
    updateTag(document.querySelector('.roadtags'), roads, 'road');

    //Initial Defects
    let defectsdata = getDefects(api, types, dists, dates, roads);
    defectsdata.then(data => {
        document.querySelector('.error').style.display = 'none';
        initialize_map(data['defects'], defectsname);
        updateDefectsCount(data['defects'], types, defectsname);
    }, () => {
        console.log('Server error occured when getting defect\'s infomation.');
        document.querySelector('.error').style.display = 'inline-block';
    }).finally(() => {
        document.querySelector('.loading').style.opacity = 0;
        setTimeout(() => {
            document.querySelector('.loading').style.opacity = null;
            document.querySelector('.loading').classList.remove('show');
        }, 320);
    });
    
    //UI Event Handlers
    closewindow.addEventListener('click', () => {
        document.querySelector('.detail').classList.remove('show');
    });

    toggle.addEventListener('change', () => {
        if(toggle.checked) {
            localStorage.setItem('changed', false);
            togglenoti.style.opacity = 0;
            title.classList.remove('title-scroll');
            title.classList.add('title-scroll');
            setTimeout(async () => {
                title.classList.remove('title-scroll');
            }, 300);
            menucontainer.style.display = 'block';
            menucontainer.style.zIndex = 3;
            menucontainer.classList.remove('menucontainer-up');
            title.style.opacity = 0.87;
            setTimeout(async () => {
                title.innerHTML = '關閉選單後套用條件';
            }, 60);
        }else {
            menucontainer.style.opacity = null;
            menucontainer.style.zIndex = null;
            menucontainer.classList.add('menucontainer-up')
            title.classList.add('title-scroll-d');
            setTimeout(async () => {
                title.classList.remove('title-scroll-d');
            }, 260);
            title.style.opacity = null;
            setTimeout(async () => {
                title.innerHTML = '道路缺失即時自動辨識查報系統';
            }, 52);
            setTimeout(async () => {
                if(!toggle.checked) {
                    togglenoti.style.opacity = null;
                    menucontainer.style.display = 'none';
                    menucontainer.classList.remove('menucontainer-up');
                }
            }, 300);
            if(localStorage.getItem('changed') == 'true') {
                defectsdata = getDefects(api, types, dists, dates, roads);
                defectsdata.then(data => {
                    document.querySelector('.error').style.display = 'none';
                    initialize_map(data['defects'], defectsname);
                    updateDefectsCount(data['defects'], types, defectsname);
                }, () => {
                    console.log('Server error occured when getting defect\'s infomation.');
                    document.querySelector('.error').style.display = 'inline-block';
                }).finally(() => {
                    document.querySelector('.loading').style.opacity = 0;
                    setTimeout(() => {
                        document.querySelector('.loading').style.opacity = null;
                        document.querySelector('.loading').classList.remove('show');
                    }, 320);
                });
            }
        }
    });

    typeall.addEventListener('change', () => {
        if(typeall.checked) {
            types = [];
            alltype.forEach(e => {
                e.checked = false;
            });
        }else {
            choosed = false;
            alltype.forEach(e => {
                if(e.checked) choosed = true;
            });
            if(!choosed) typeall.checked = true;
        }
        saveData();
    });

    alltype.forEach(e => {
        e.addEventListener('change', () => {
            choosed = false;
            alltype.forEach(e => {
                if(e.checked) choosed = true;
            })
            if(!choosed) typeall.checked = true;
            else typeall.checked = false;
            saveData();
        });
    });

    document.querySelector('.menu .date').addEventListener('focus', () => {
        document.querySelector('.menu .date').blur();
    });

    menumore.addEventListener('click', () => {
        let advanced = document.querySelector('.menucontainer .advanced');
        if(advanced.classList.contains('show')) {
            advanced.classList.add('up');
            setTimeout(() => {
                advanced.classList.remove('show');
                advanced.classList.remove('up');
                menumore.innerHTML = '開啟進階選項'
            }, 300);
        }else {
            menumore.innerHTML = '關閉進階選項'
            advanced.classList.add('show');
        }
    });

    adddate.addEventListener('click', () => {
        let value = document.querySelector('.menu .date').value;
        if(value == '') return false;
        if(dates.indexOf(value) == -1) {
            dates.push(value);
            updateTag(document.querySelector('.datetags'), dates, 'date');
        }
        document.querySelector('.menu .date').value = null;
        saveData();
    });

    adddist.addEventListener('click', () => {
        let value = document.querySelector('.menu .dist').value;
        let name = document.querySelector('.menu .dist').options[document.querySelector('.menu .dist').selectedIndex].text;
        if(value == '') return false;
        //2D Array Check Existed
        let duplicated = 0;
        dists.forEach(e => {
            if(e[0] == value) duplicated = 1;
        });
        if(duplicated == 0) {
            dists.push([value, name]);
            updateTag(document.querySelector('.disttags'), dists, 'dist');
        }
        saveData();
    });

    addmachi.addEventListener('click', () => {
        let regexp = /^([\u4E00-\u9FFF]+)(,[\u4E00-\u9FFF]+)*$/;
        let value = document.querySelector('.menu .machi').value;
        if(value == '' || !regexp.test(value)) return false;
        if(roads.indexOf(value) == -1) {
            roads.push(value);
            updateTag(document.querySelector('.roadtags'), roads, 'road');
        }
        document.querySelector('.menu .machi').value = null;
        document.querySelector('.menu .machi').focus();
        saveData();
    });

    title.addEventListener('click', () => {
        console.log(types);
    })

    function saveData() {
        localStorage.setItem('changed', true);
        /* Start of Saving Filters */
        if(typeall.checked) {
            types = [];
        }else {
            types = [];
            alltype.forEach(e => {
                if(e.checked) {
                    types.push(e.dataset.type);
                }
            });
        }
        localStorage.setItem('types', JSON.stringify(types));
        localStorage.setItem('dists', JSON.stringify(dists));
        localStorage.setItem('dates', JSON.stringify(dates));
        localStorage.setItem('roads', JSON.stringify(roads));
        /* End of Saving Filters */
    }
});

function initialize_map(defects, defectsname) {
    document.querySelector('.map').style.display = 'block';
    map = new google.maps.Map(
        document.querySelector('.map'), {
            center: new google.maps.LatLng(24.76184, 121.06753),
            zoom: 16,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: true,
            scrollwheel: true,
            fullscreenControl: false
        }
    );
    for (let i = 0; i < defects.length; i++) {
        const marker = new google.maps.Marker({
            position: new google.maps.LatLng(defects[i].GPS_y, defects[i].GPS_x),
            icon: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png',
            map: map,
        });
        marker.addListener('click', () => {
            document.querySelector('.detail .window .type').innerHTML = `${defectsname[defects[i].markid]}`;
            document.querySelector('.detail .window .datetime').innerHTML = `${defects[i].markdate}`;
            document.querySelector('.detail .window .coordinate').innerHTML = `${defects[i].GPS_x}, ${defects[i].GPS_y}`;
            document.querySelector('.detail').classList.add('show');
        });
    }    
}

function updateTag(target, data, type) {
    target.innerHTML = '';
    for(let i = 0;i<data.length;i++) {
        if(type == 'dist') {
            target.insertAdjacentHTML('beforeend', `<span class="tag" data-type="${type}">${data[i][1]}<span data-role="remove" data-index="${i}"></span></span>`);
        }else {
            target.insertAdjacentHTML('beforeend', `<span class="tag" data-type="${type}">${data[i]}<span data-role="remove" data-index="${i}"></span></span>`);
        }
    }
    let tags = target.querySelectorAll('.tag [data-role="remove"]');
    tags.forEach(tag => {
        let index = tag.dataset.index;
        tag.addEventListener('click', () => {
            localStorage.setItem('changed', true);
            data.splice(index, 1);
            updateTag(target, data, type);
            /* Start of Saving Filters */
            localStorage.setItem(type+'s', JSON.stringify(data));
            /* End of Saving Filters */
        });
    });
}

function updateDefectsCount(data, types, defectsname) {
    defectsinfo = document.querySelector('.defectsinfo');
    defectsinfo.innerHTML = null;
    let count = [];
    for([key, value] of Object.entries(defectsname)) {
        count[key] = 0;
    }
    for (let i = 0; i < data.length; i++) {
        count[data[i].markid] += 1;
    }
    if(types.length == 0) {
        for([key, value] of Object.entries(defectsname)) {
            defectsinfo.insertAdjacentHTML('beforeend', `<div class="type">${key} ${value}：${count[key]}</div>`);
        }
    }else {
        types.forEach(e => {
            defectsinfo.insertAdjacentHTML('beforeend', `<div class="type">${e} ${defectsname[e]}：${count[e]}</div>`)
        })
    }
}

function getDist(api) {
    return Promise.resolve($.ajax({
        url: api+'/v1/get/dists',
        dataType: "json",
        type: "get",
        timeout: 5000
    }));
}

function getDefects(api, types, dists, dates, roads) {
    let typestring = '', diststring = '', datestring = '', roadstring = '';
    for(let i = 0; i < types.length; i++) {
        if(i == 0) typestring += types[i];
        else typestring += ','+types[i];
    }
    for(let i = 0; i < dists.length; i++) {
        if(i == 0) diststring += dists[i][0];
        else diststring += ','+dists[i][0];
    }
    for(let i = 0; i < dates.length; i++) {
        if(i == 0) datestring += dates[i];
        else datestring += ','+dates[i];
    }
    for(let i = 0; i < roads.length; i++) {
        if(i == 0) roadstring += roads[i];
        else roadstring += ','+roads[i];
    }
    document.querySelector('.loading').classList.add('show');
    return Promise.resolve($.ajax({
        url: api+'/v1/get/defects',
        dataType: "json",
        type: "get",
        data: {
            'dist': diststring,
            'road': roadstring,
            'date': datestring,
            'type': typestring
        },
        timeout: 5000
    }));
}

function initDropdownSearch(classname) {
    let select = document.querySelector(classname);
    
    select.insertAdjacentHTML('afterend', `<div class="list"></div>`);
    select.insertAdjacentHTML('afterend', `<div class="${classname.replace('.', '')}"></div>`);

    select.style.display = 'none';

    let dummyselect = document.querySelector('.menu .select div.dist');
    dummyselect.innerHTML = select.options[0].text;

    let list = document.querySelector('.menu .list');

    list.insertAdjacentHTML('afterbegin', `<ul></ul>`)

    for(let i = 0; i < select.options.length; i++) {
        list.querySelector('ul').insertAdjacentHTML('beforeend', `<li class="option" data-value="${select.options[i].value}">${select.options[i].text}</li>`);
    }

    list.insertAdjacentHTML('afterbegin', `<div class="search"><input type="text" class="searchbox" placeholder="搜尋..."></div>`);

    let searchbox = list.querySelector('.searchbox');

    searchbox.addEventListener('keyup', () => {
        list.querySelectorAll('.option').forEach(e => {
            (e.innerHTML.indexOf(searchbox.value.replace('台', '臺')) > -1) ? e.classList.remove('hide') : e.classList.add('hide');
        });
    });

    dummyselect.addEventListener('click', () => {
        if(list.classList.contains('show')) {
            closeDropdown();
        }else {
            list.querySelectorAll('.option').forEach(e => {
                (e.innerHTML.indexOf(searchbox.value.replace('台', '臺')) > -1) ? e.classList.remove('hide') : e.classList.add('hide');
            });
            $('.menu .list').animate({ scrollTop: 0 }, "300");
            list.classList.add('show');
            dummyselect.classList.add('active');
        }
    });

    list.querySelectorAll('.option').forEach(e => {
        e.addEventListener('click', () => {
            dummyselect.innerHTML = e.innerHTML;
            select.value = e.dataset.value;
            closeDropdown();
        });
    });

    function closeDropdown() {
        list.classList.add('up');
        setTimeout(() => {
            list.classList.remove('show');
            list.classList.remove('up');
            dummyselect.classList.remove('active');
        }, 300);
    }
}