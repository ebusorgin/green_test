(async () => {
    const response = await fetch('https://cdn.socket.io/4.5.0/socket.io.min.js');
    if (!response.ok) {
        alert('что-то пошло не так');
        return;
    }

    const scriptText = await response.text();
    const socketIoModule = new Function(scriptText);
    socketIoModule();

    const socket = io('https://green.xyyzzz.ru', {
        auth: {
            token: page.storage.getCookies('token')
        }
    });

    socket.on('connect', () => {
        $('#server_connection').hide()
        $('#root').show()
    });

    socket.on('auth', (response) => {
        if (!response.success) {
            console.error('Authentication failed');
            document.getElementById('login_form').style.display = 'block';
            $('#login_form').show()
        } else {
            $('#login_form').hide()
            $('#root').show()
            $('#main').show()
            for (let i = 0; i < response.data.instances.length; i++) {
                const instance = response.data.instances[i];
                const exists = page.instances.some(item => item.id === instance.id);
                if (!exists) {
                    page.instances.push({ id: instance.id, token: instance.token, type: 'xyz' });
                }
            }
            page.renderInstanceList();
            page.storage.setCookie('token', response.data.user.token);

        }
    });

    socket.on('connectWhatsapp', (data) => {
        document.getElementById('qr').setAttribute("src", data.qr);
    });
    socket.on('whatsappReady', (data) => {
        page.instances.push({id:data.instance.id, token:data.instance.token,type:'xyz'})
        page.renderInstanceList();
        page.popup.close()
        document.getElementById('qr').setAttribute("src", '/loading.gif');

    });
    socket.on('deleteInstance', (data) => {
        const index = page.instances.findIndex(instance => instance.id === data.id);
        if (index !== -1) {
            page.instances.splice(index, 1);
            page.renderInstanceList();
        }
    })

    socket.on('disconnect', () => {
        document.getElementById('server_connection').style.display = 'block';
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });


    $('#btnGetSettings').addEventListener('click', await page.api.getSettings);
    $('#btnGetStateInstance').addEventListener('click', await page.api.getStateInstance);
    $('#btnSendMessage').addEventListener('click', await page.api.sendMessage);
    $('#btnSendFileByUrl').addEventListener('click', await page.api.sendFileByUrl);

    function send(method, data) {
        console.log("OUT", method, data);
        return new Promise((resolve, reject) => {
            socket.emit(method, data, (response) => {
                if (response.success) {
                    console.log("IN", response.data);
                    resolve(response.data);
                } else {
                    reject(response.message || 'An error occurred');
                }
            });

            setTimeout(() => {
                reject('Request timed out');
            }, 10000);
        });
    }

    $('#btnSetAuth').addEventListener('click', async () => {
        const login = $('#login').value;
        if (!login) {
            alert('введите логин');
            return
        }
        send('auth', {login}).then(data => {
            page.storage.set('user', data.user)
            page.storage.setCookie('token', data.user.token);
            $('#login_form').hide()
            $('#main').show()

        });

    })

})();

class Page {
    instances = []
    currentInstance = null
    socket = null
    storage = {
        set(key, value) {
            if (typeof value === "object") {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                console.warn("Value should be an object!");
            }
        },

        get(key) {
            const retrievedData = localStorage.getItem(key);
            try {
                return retrievedData ? JSON.parse(retrievedData) : null;
            } catch (e) {
                console.error("Error parsing JSON from localStorage:", e);
                return null;
            }
        },
        clear(key) {
            localStorage.removeItem(key);
            console.log(`Данные с ключом '${key}' удалены из localStorage.`);
        },
        getCookies(name) {
            const cookies = document.cookie.split('; ');
            for (let cookie of cookies) {
                const [key, value] = cookie.split('=');
                if (key === name) {
                    return value;
                }
            }
            return null;
        },
        setCookie(name, value, days = 7) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            document.cookie = `${name}=${value}; ${expires}; path=/`;
        }
    }
    popup = {
        show: () => {
            $('#popup').show()
            $('.overlay').show()
        },
        close: () => {
            $('#popup').hide()
            $('.overlay').hide()
            $('#popupIdInstance').value = '';
            $('#popupApiToken').value = '';
        }
    }
    api ={
        sendFileByUrl:async ()=>{
            let phoneNumber = $('#phoneNumber').value;
            const fileUrl = $('#fileUrl').value;

            if (!phoneNumber || !fileUrl) {
                alert('Please provide both phone number and file URL!');
                return;
            }
            try {
                phoneNumber = page.formatPhoneNumber(phoneNumber);
            } catch (error) {
                alert(error.message);
                return;
            }
            const fileName = fileUrl.split('/').pop().split('?')[0] || 'default-file-name';

            handleResponse(await this.http('sendFileByUrl',{chatId: phoneNumber, urlFile: fileUrl, fileName}));
        },
        sendMessage:async ()=>{

            let phoneNumber = $('#phoneNumber').value;
            const message = $('#message').value.trim();

            if (!phoneNumber || !message) {
                alert('Please provide both phone number and message!');
                return;
            }

            try {
                phoneNumber = page.formatPhoneNumber(phoneNumber);
            } catch (error) {
                alert(error.message);
                return;
            }

            handleResponse(await this.http('sendMessage',{ chatId: phoneNumber, message }));
        },
        getSettings:async ()=>handleResponse(await this.http('getSettings',{ },'GET')),
        getStateInstance:async ()=>handleResponse(await this.http('getStateInstance',{ },'GET')),
        deleteInstanceAccount:async (data)=>handleResponse(await this.http('deleteInstanceAccount',data,'POST')),

    }
    constructor() {
        this.initializeInstanceList();
    }
    async http(method, body={}, type = 'POST') {
        let url = `https://api.green-api.com`
        this.currentInstance.type==='green'?null:url = `https://green.xyyzzz.ru`;

        const fetchOptions = {
            method: type,
            headers: { 'Content-Type': 'application/json' }
        };

        if (type !== 'GET') {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(`${url}/waInstance${this.currentInstance.id}/${method}/${this.currentInstance.token}`, fetchOptions);
        return await response.json();
    }

    formatPhoneNumber(phoneNumber) {
        phoneNumber = phoneNumber.trim();

        if (phoneNumber.includes('@c.us')) {
            phoneNumber = phoneNumber.replace('@c.us', '');
        }

        const phoneRegex = /^\d{7,15}$/;
        if (!phoneRegex.test(phoneNumber)) {
            throw new Error('Invalid phone number! Please enter a valid number.');
        }

        if (!phoneNumber.includes('@c.us')) {
            phoneNumber += '@c.us';
        }
        return phoneNumber;
    }
    initializeInstanceList() {
        const savedInstances = this.storage.get('instances') || [];
        this.instances.push(...savedInstances);
        this.renderInstanceList();
    }

    addInstanceToList() {
        const id = $('#popupIdInstance').value;
        const token = $('#popupApiToken').value;
        const instance = {id, token,type:'green'}
        if (!instance.id || !instance.token) {
            alert('заполните все поля');
            return
        }
        this.popup.close();
        this.instances.push(instance);
        this.storage.set('instances', this.instances);
        this.renderInstanceList();
    }

    async removeInstance(id) {
        const index = this.instances.findIndex(instance => instance.id === id);
            this.currentInstance = this.instances[index];
            console.log("assssssssss",id,index);
        if (index !== -1) {
            if (this.instances[index].type==='xyz') {
                await this.api.deleteInstanceAccount(this.instances[index])
            }
            $('#form_green').hide()
            $('#response').clear()
            $('#contacts').clear()
            $('#messages').clear()
            $('#phoneNumber').value = ''

            this.instances.splice(index, 1);
            this.storage.set('instances', this.instances);
            this.currentInstance = null
            this.renderInstanceList();
        }
    }

    renderInstanceList() {
        const instanceList = document.getElementById('instanceList');
        instanceList.innerHTML = '';

        this.instances.forEach(instance => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.marginBottom = '8px';

            const button = document.createElement('button');
            button.innerHTML = `<div>${instance.id}</div>`;
            button.style.marginRight = '10px';
            button.style.backgroundColor = instance.type===`green`?'#207e01':'#0d5ed6';

            button.addEventListener('click', async () => {
                this.currentInstance = instance
                    $('#form_green').show()
                    $('#response').clear()
                    $('#contacts').clear()
                    $('#messages').clear()
                    $('#phoneNumber').value = ''

                    $('#idInstance').value = this.currentInstance.id;
                    $('#apiTokenInstance').value = this.currentInstance.token;


                    const contacts = await this.http('getContacts',{});
                    contacts.map(c => {
                        const contact = document.createElement('div');
                        contact.innerHTML = `<div class="contact">${c.id}<br>${c.name||c.contactName}</div>`;
                        contact.addEventListener('click', async () => {
                            $('#messages').clear()
                            $('#phoneNumber').value = c.id

                            const messages = await this.http('getChatHistory',{ chatId: c.id, count: 50 });
                            if (messages.length===0){
                                $('#messages').innerHTML = '<div>нет сообщений</div>';
                            }
                            messages.map(m=>{
                                const message = document.createElement('div');
                                message.innerHTML = `<div class="message">${m.typeMessage}<br>${m.textMessage||m.idMessage}</div>`;
                                $('#messages').appendChild(message);
                            })
                        })
                        $('#contacts').appendChild(contact);
                    })
            });

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Удалить';
            deleteButton.style.backgroundColor = '#ff4d4d';
            deleteButton.style.color = '#fff';

            deleteButton.addEventListener('click', () => {
                this.removeInstance(instance.id);
            });

            li.appendChild(button);
            li.appendChild(deleteButton);
            instanceList.appendChild(li);
        });
    }

}



const page = new Page();
function handleResponse(response) {
    $('#response').innerHTML = JSON.stringify(response, null, 2);
}

const $ = function (selector) {
    const isClass = selector.startsWith(".");
    const isId = selector.startsWith("#");

    let elements;
    if (isClass) {
        elements = document.querySelectorAll(selector);
    } else if (isId) {
        const element = document.querySelector(selector);
        elements = element ? [element] : [];
    } else {
        return null;
    }
    const api = {
        show() {
            elements.forEach(el => {
                if (el) {
                    const currentDisplay = window.getComputedStyle(el).display;
                    el.style.display = currentDisplay === "none" ? "block" : currentDisplay;
                }
            });
            return api;
        },
        hide() {
            elements.forEach(el => {
                if (el) el.style.display = "none";
            });
            return api;
        },
        clear() {
            elements.forEach(el => {
                if (el) el.innerHTML = '';
            });
            return api;
        },
    };
    return Object.assign(elements.length === 1 ? elements[0] : elements, api);
};




