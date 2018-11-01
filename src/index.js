'use strict';

// TODO: until 'startup' section, only React components should be on the top level

firebase.initializeApp({
    apiKey: 'AIzaSyDszUxv08D7ypv15AfgipQ36sWbkjQUglc',
    authDomain: 'jpco-qtodo.firebaseapp.com',
    projectId: 'jpco-qtodo'
});
var db = firebase.firestore();
db.settings({timestampsInSnapshots: true});

function Title({user, addTodo}) {
    let un = "";
    if (user.isAnonymous) {
        un = "anonymous";
    } else {
        un = user.displayName;
    }
    return (
        <div>
            Signed in as {un} <button onClick={() => firebase.auth().signOut()}>Sign out</button>
            <h1>
                Qdo <button onClick={() => addTodo()}>Add item</button>
            </h1>
        </div>
    );
}

const hashCode = (str) => {
    var hash = 0, i, chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
        chr   = str.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

const swap = (t1, t2, field) => {
    let batch = db.batch();
    batch.set(db.collection('todo').doc(t1.id), {[field]: t2[field]}, {merge: true});
    batch.set(db.collection('todo').doc(t2.id), {[field]: t1[field]}, {merge: true});
    batch.commit().catch((error) => console.error('error swapping todos: ', error));
};

function FuncButton({onClick, children}) {
    if (onClick) {
        return (<button onClick={onClick}>{children}</button>);
    }
    return (<button disabled>{children}</button>);
}

function DropdownItem({onClick, children}) {
    if (!onClick) {
        return null;
        // return (<a className="disabled">{children}</a>);
    } else {
        return (<button className="notdisabled" onClick={onClick}>{children}</button>);
    }
}

function Dropdown({name, children}) {
    return (
        <div className="dropcontainer">
            <button className="dropper">{name}</button>
            <div className="dropdown">
                {children}
            </div>
        </div>
    );
}

// move contains .up and .down
function TodoQueueItem({todo, remove, update, move}) {
    let input;

    const Context = () => {
        if (!todo.parent) {
            return null;
        }
        let t = todo;
        let it = [];
        while (t.parent) {
            t = t.parent;
            it.push(t.text);
        }
        it.reverse();
        return (
            <a className="context">{it.join(' - ')} -</a>
        );
    };

    return (
        <li className="liNode">
            <FuncButton onClick={() => remove(todo)}>x</FuncButton>
            <Dropdown name="o">
                <DropdownItem onClick={move.up}>Move up</DropdownItem>
                <DropdownItem onClick={move.down}>Move down</DropdownItem>
            </Dropdown>
            <Context />
            <input type="text" className="todoInput qTodoInput"
                ref={(node) => input = node}
                defaultValue={todo.text}
                onBlur={() => update(input.value, todo)}
            />
        </li>
    );
}

function TodoQueue({todos, remove, update}) {
    const queue = todos
        .sort((t1, t2) => t2.qOrder - t1.qOrder);

    let todoNode = [];
    for (let i = 0; i < queue.length; i++) {
        const move = {
            up: i === 0 ? null : () => swap(queue[i], queue[i-1], 'qOrder'),
            down: i === queue.length - 1 ? null : () => swap(queue[i], queue[i+1], 'qOrder')
        };
        todoNode.push(
            <TodoQueueItem
                todo={queue[i]}
                key={queue[i].id + '-' + hashCode(queue[i].text)}
                remove={remove}
                update={update}
                move={move}
            />
        );
    }
    return (<ul className="queue">{todoNode}</ul>);
}

// move contains .up, .down, .out, .in, and .top
function TodoTreeItem({todo, add, remove, update, move}) {
    let input;

    const SubTodos = ({children}) => {
        if (children.length === 0) {
            return null;
        }
        return (
            <TodoTree
                todos={children}
                add={add}
                remove={remove}
                update={update}
            />
        );
    };

    return (
        <li>
            <span className="liNode">
                <FuncButton
                    onClick={todo.children.length !== 0 ? null : () => remove(todo)}
                >x</FuncButton>
                <Dropdown name="o">
                    <DropdownItem onClick={() => add("", todo)}>Add sub-item</DropdownItem>
                    <DropdownItem onClick={move.top}>Move to top</DropdownItem>
                    <DropdownItem onClick={move.up}>Move up</DropdownItem>
                    <DropdownItem onClick={move.down}>Move down</DropdownItem>
                    <DropdownItem onClick={move.out}>Move out</DropdownItem>
                    <DropdownItem onClick={move.in}>Move in</DropdownItem>
                </Dropdown>

                <input type="text" className="todoInput tTodoInput"
                    ref={(node) => input = node}
                    defaultValue={todo.text}
                    onBlur={() => update(input.value, todo)}
                />
            </span>
            <SubTodos children={todo.children} />
        </li>
    );
}

function TodoTree({todos, add, remove, update}) {
    const setParent = (todo, parent) => {
        db.collection('todo').doc(todo.id)
            .set({
                parent: parent ? parent.id : null
            }, {merge: true})
            .catch((error) => console.error('error swapping todos: ', error));
    };

    const tree = todos.sort((t1, t2) => t2.tOrder - t1.tOrder);

    let todoNode = [];
    for (let i = 0; i < tree.length; i++) {
        const move = {
            top: null,  // until 'move' is implemented
            up: i === 0 ? null : () => swap(tree[i], tree[i-1], 'tOrder'),
            down: i === tree.length - 1 ? null : () => swap(tree[i], tree[i+1], 'tOrder'),
            out: tree[i].parent ? () => setParent(tree[i], tree[i].parent.parent) : null,
            in: i === 0 ? null : () => setParent(tree[i], tree[i-1])
        };
        todoNode.push(
            <TodoTreeItem
                todo={tree[i]}
                key={tree[i].id + '-' + hashCode(tree[i].text)}
                add={add}
                remove={remove}
                update={update}
                move={move}
            />
        );
    }
    return (<ul>{todoNode}</ul>);
}

class TodoApp extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            qNext: 0,
            tNext: 0,
            todos: []
        }

        db.collection('todo')
            .where("ownerId", "==", this.props.user.uid)
            .onSnapshot(this.updateTodos.bind(this),
                (error) => console.error("Could not read todo list: ", error));
    }

    updateTodos(snapshot) {
        let todoMap = {};
        snapshot.forEach((doc) => {
            const data = doc.data();
            todoMap[doc.id] = {
                id: doc.id,
                qOrder: data.qOrder,
                tOrder: data.tOrder,
                text: data.text,
                parent: data.parent,
                children: []
            };
        });

        Object.values(todoMap).forEach((todo) => {
            if (todo.parent && todoMap[todo.parent]) {
                todo.parent = todoMap[todo.parent];
                todo.parent.children.push(todo);
            }
        });

        const todos = Object.values(todoMap);
        const qMax = todos.reduce((max, t) => Math.max(max, t.qOrder), 0);
        const tMax = todos.reduce((max, t) => Math.max(max, t.tOrder), 0);
        this.setState({qNext: qMax + 1, tNext: tMax + 1, todos: todos});
    }

    handleAdd(val, parent) {
        db.collection('todo').add({
            text: (!val ? "" : val),
            qOrder: this.state.qNext,
            tOrder: this.state.tNext,
            ownerId: this.props.user.uid,
            parent: (!parent ? null : parent.id)
        }).catch((error) => console.error('error adding todo: ', error));
    }

    handleRemove(todo) {
        let batch = db.batch();
        const recRemove = (batch, todo) => {
            batch.delete(db.collection('todo').doc(todo.id));
            if (todo.parent && todo.parent.children.length === 1) {
                recRemove(batch, todo.parent);
            }
        };

        todo.children.forEach((ch) => batch.delete(db.collection('todo').doc(ch.id)));
        recRemove(batch, todo);
        batch.commit();
    }

    handleUpdate(val, todo) {
        if (todo.value != val) {
            db.collection('todo').doc(todo.id).set({text: val}, {merge: true})
                .catch((error) => console.error('error updating todo: ', error));
        }
    }

    render() {
        return (
            <div>
                <Title user={this.props.user} addTodo={this.handleAdd.bind(this)} />
                <TodoQueue
                    todos={this.state.todos
                        .filter((todo) => todo.children.length === 0)}
                    remove={this.handleRemove.bind(this)}
                    update={this.handleUpdate.bind(this)}
                />
                <h2>All</h2>
                <TodoTree
                    todos={this.state.todos
                        .filter((todo) => !todo.parent)}
                    add={this.handleAdd.bind(this)}
                    remove={this.handleRemove.bind(this)}
                    update={this.handleUpdate.bind(this)}
                />
            </div>
        );
    }
}

// startup -- verify user is logged in as the right person

window.uid = null;
window.addEventListener('load', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user && (window.uid === null || user.uid === window.uid)) {
            window.uid = user.uid;
            ReactDOM.render(<TodoApp user={user} />, document.getElementById('container'));
        } else if (user) {
            window.location.reload();
        } else {
            window.location.replace('login');
        }
    });
});
