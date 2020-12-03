document.addEventListener('DOMContentLoaded', () => {
    //Set API Source
    let api = 'https://roadapi.lilithraws.cf';

    //Initial Google Map
    let map;
    initialize_map();

    //Initial Date Picker
    $('[data-toggle="datepicker"]').datepicker({
        language: 'zh-TW',
        autoHide:true,
        format:'yyyy-mm-dd',
        formatted:true,
        endDate:Date()
    });

    //Initial Data Arrays
    let types = [];
    let dists = [];
    let dates = [];
    let roads = [];

    //UI Elements
    let toggleshape = document.querySelector('.toggle');
    let toggle = document.querySelector('.toggle input');
    let togglenoti = document.querySelector('.toggle-noti');
    let title = document.querySelector('.title');
    let menucontainer = document.querySelector('.menucontainer');
    let alltype = document.querySelectorAll('.type:not(.all)');
    let typeall = document.querySelector('.type.all')
    let chooseall = true;
    let adddate = document.querySelector('.adddate');
    let adddist = document.querySelector('.adddist');
    let addmachi = document.querySelector('.addmachi');

    let dist = document.querySelector('.dist');

    //Initial Dist List
    let distsdata = getDist(api);
    distsdata.then(data => {
        data['dists'].forEach(e => {
            dist.insertAdjacentHTML('beforeend', `<option value="${e['dist_id']}">${e['dist_name']}</option>`)
        });
    });

    //UI Event Handlers
    toggle.addEventListener('change', () => {
        if(toggle.checked) {
            togglenoti.style.opacity = 0;
            menucontainer.style.display = 'block';
            menucontainer.style.zIndex = 3;
            menucontainer.classList.remove('menucontainer-up');
            title.style.opacity = 0.87;
            title.innerHTML = '關閉選單後套用條件';
        }else {
            menucontainer.style.opacity = null;
            menucontainer.style.zIndex = null;
            menucontainer.classList.add('menucontainer-up')
            title.style.opacity = null;
            title.innerHTML = '道路缺失即時自動辨識查報系統';
            setTimeout(async () => {
                if(!toggle.checked) {
                    togglenoti.style.opacity = null;
                    menucontainer.style.display = 'none';
                    menucontainer.classList.remove('menucontainer-up');
                }
            }, 320)
        }
    });

    typeall.addEventListener('change', () => {
        let alltype = document.querySelectorAll('.menu .container input');
        if(typeall.checked) {
            alltype.forEach(e => {
                e.checked = true;
            });
        }else {
            alltype.forEach(e => {
                e.checked = false;
            });
        }
    });

    alltype.forEach(e => {
        e.addEventListener('change', () => {
            chooseall = true;
            alltype.forEach(e => {
                if(!e.checked) chooseall = false;
            })
            if(!chooseall) typeall.checked = false;
            else typeall.checked = true;
        });
    });

    document.querySelector('.menu .date').addEventListener('focus', () => {
        document.querySelector('.menu .date').blur();
    })

    adddate.addEventListener('click', () => {
        let value = document.querySelector('.menu .date').value;
        if(value == '') return false;
        if(dates.indexOf(value) == -1) {
            dates.push(value);
            updateTag(document.querySelector('.datetags'), dates, 'date');
        }
        document.querySelector('.menu .date').value = null;
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
    });

    title.addEventListener('click', () => {
        console.log(dists);
    })
});

function initialize_map() {
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
}

function updateTag(target, data, type, name) {
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
            data.splice(index, 1);
            updateTag(target, data, type)
        });
    });
}

function getDist(api) {
    return Promise.resolve($.ajax({
        url: api+'/v1/get/dists',
        dataType: "json",
        type: "get"
    }));
}