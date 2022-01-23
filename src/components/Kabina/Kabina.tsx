/* eslint-disable no-restricted-globals */
import axios from "axios";
import { parse } from 'query-string';
import MaterialTable from "material-table";
import { FunctionComponent, useEffect, useState } from "react";
import logo from '../../kabina-logo.png';
import './Kabina.css'

export const Kabina: FunctionComponent = () => {
    const [stops, setStops] = useState<Array<Stop>>([]);
    const [orders, setOrders] = useState<Array<TaxiOrder>>([]);
    const [inputs, setInputs] = useState({
        status : "",
        fromStand : -1,
        toStand : -1,
        maxWait : 10, // how long can I wait for a cab
        maxLoss : 30, // [%] how long can I lose while in pool
        shared : true,
        atTime : ""
    });
    //const [custId, setCustId] = useState<number>(0);
    let custId = 0; // default
    
    if (location && location.search) {
        const json = parse(location.search);
        let id = json['cust_id'];
        if (id) {
            custId = Number(id);
        }
    }

    const columns = [
        { title: 'Stop', field: 'stop', width: '40%'},
        { title: 'Status', field: 'status'},
        { title: 'Distance to', field: 'distance'}
    ];

    const orderColumns = [
        { title: 'ID', field: 'id'},
        { title: 'Status', field: 'status'},
        { title: 'From', field: 'from'},
        { title: 'To', field: 'to'},
        { title: 'Max wait', field: 'maxWait'},
        { title: 'Shared', field: 'shared'},
        { title: 'In pool', field: 'inPool'},
        { title: 'Received', field: 'received'},
        { title: 'At time', field: 'atTime'},
        { title: 'ETA', field: 'eta'},
        { title: 'Cab', field: 'cab'},
        { title: 'Route', field: 'route.id'}
    ];

    const credentials = (id: number) => {
        return {
            username: 'cust' + id,
            password: 'cust' + id
        }
    }

    function parseResponse(input: Order[]) : TaxiOrder[] {
        let orderArr: TaxiOrder[] = [];
        if (!input || input.length === 0) {
            return [];
        }
        
        for (let order of input) {
            if (order.status === 'REFUSED') { continue; }
            let rowArr: TripLeg[] = [];
            if (order.route && order.route.status !== 'COMPLETED') { 
                let firstFound = false;
                let distance = 0;
                for (let leg of order.route.legs) {
                    // find the first leg for this customer
                    if (!firstFound && leg.fromStand === order.fromStand) {
                        firstFound = true;
                        rowArr.push(new TripLeg(
                            stopName(leg.fromStand),
                            explain(leg.status),
                            0
                        ));
                        distance = leg.distance;
                    } else if (firstFound) {
                        rowArr.push(new TripLeg(
                            stopName(leg.fromStand),
                            explain(leg.status),
                            distance === 0 ? 1 : distance
                        ));
                        distance = leg.distance; // we need to show the distance of the previous leg
                    }
                    if (leg.toStand === order.toStand) {
                        rowArr.push(new TripLeg(
                            stopName(leg.toStand),
                            explain(leg.status),
                            leg.distance === 0 ? 1 : leg.distance
                        ));
                        break;
                    }
                }
            }
            orderArr.push(new TaxiOrder(
                new TripOrder(
                    order.id, 
                    order.status,
                    order.fromStand,
                    order.toStand,
                    order.distance,
                    order.maxWait,
                    order.maxLoss,
                    order.shared,
                    trimDate(order.received),
                    trimDate(order.started),
                    trimDate(order.completed),
                    order.atTime,
                    order.eta,
                    order.inPool,
                    order.cab,
                    order.leg,
                    order.route
                ), 
                rowArr
            ));
        }
        return orderArr;
    }

    function trimDate(date: Date) : string {
        return date && date.toString().length > 19
            ? date.toString().replaceAll('T',' ').substring(0, 19) : "";
    }

    function explain(status: string) {
        switch(status) {
            case 'ASSIGNED': return '';
            case 'STARTED' : return 'LEFT BEHIND'
            case 'COMPLETED': return 'VISITED';
        }
        return '';
    }

    function stopName(id: number) : string {
        let s = stops.find(i => i.id == id); // === would fail
        if (s) {
            return s.name;
        } 
        return "<unknown>";
    }

    function getRoute() {
        if (stops.length === 0) { // still waiting for stops
            return; 
        }
        axios.get('http://localhost/orders', { auth: credentials(custId) })
            .then(response => {
                if (response.data) {
                    setOrders(parseResponse(response.data));
                }
            });
    }

    useEffect(() => {
        getRoute();
        let interval = setInterval(() => getRoute(), 30000);
        return () => { clearInterval(interval); }
    }, [stops]);

    useEffect(() => {
        axios.get('http://localhost/stops', { auth: credentials(0) })
        .then(response => setStops(response.data)); 
    }, []);


    function renderHeader(order: TripOrder) {
      return ( 
        <table style={{ padding: '0px' }} >
          <tbody>
            <tr><th align='right'>Order ID : </th> <td align='left'>{order.id}</td></tr>
            <tr><th align='right'>Status : </th>   <td align='left'>{order.status}</td></tr>
            <tr><th align='right'>From : </th>     <td align='left'>{stopName(order.fromStand)}</td></tr>
            <tr><th align='right'>To : </th>       <td align='left'>{stopName(order.toStand)}</td></tr>
            <tr><th align='right'>Distance : </th> <td align='left'>{order.distance}</td></tr>
            <tr><th align='right'>Dist. with pool : </th>
                <td align='left'>{countDistance(order)}</td></tr>
            <tr><th align='right'>Max wait : </th> <td align='left'>{order.maxWait}</td></tr>
            <tr><th align='right'>Shared : </th>   <td align='left'>{order.shared?"YES":"NO"}</td></tr>
            <tr><th align='right'>In pool : </th>  <td align='left'>{order.inPool}</td></tr>
            <tr><th align='right'>Received : </th> <td align='left'>{order.received}</td></tr>
            <tr><th align='right'>Started : </th>  <td align='left'>{order.started}</td></tr>
            {  order.atTime ?
                <tr><th align='right'>At time : </th>  <td align='left'>{order.atTime}</td></tr>
                : <></>
            }
            <tr><th align='right'>ETA : </th>      <td align='left'>{order.eta}</td></tr>
            <tr><th align='right'>Cab : </th>      <td align='left'>{order.cab}</td></tr>
            <tr><th align='right'>Route : </th>    <td align='left'>{order.route ? order.route.id : ""}</td></tr>
          </tbody>
        </table>
      );
    }

    function countDistance(order: TripOrder) : number {
        let foundStart = false;
        let sum = 0;
        let from = order.fromStand;
        let to = order.toStand;
        if (!order.route || !order.route.legs) {
            return -1; // serious error, no legs
        }
        for (const l of order.route.legs) {
            if (from === l.fromStand) {
                foundStart = true;
                sum += (l.distance === 0 ? 1 : l.distance) + 1; // one minute (km) on the stop
            } 
            if (foundStart && from !== l.fromStand) { // consecutive leg 
                sum += (l.distance === 0 ? 1 : l.distance) + 1;
            }
            if (to === l.toStand) { // it might be the same leg as above
                return sum - 1; //the time spent on the last stop does not count
            }
        }
        return -2; // some serious error - noe last leg
    }

    const buttonHandler = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const button: HTMLButtonElement = event.currentTarget;
        axios.put('http://localhost/orders/' + button.name, 
                    { status : 'ACCEPTED' }, { auth: credentials(custId) })
            .then(function (response) {
                alert(response.data);
            })
            .catch(function (error) {
                alert(error);
            });
    };
      
    function renderRoutes() {
        return orders.map((item, index) => {
           return ( 
            <>
                {renderHeader(item.order)}
                { item.order.status === 'ASSIGNED' 
                  ? <button onClick={buttonHandler} name={item.order.id.toString()}>
                        Accept assignement
                    </button>
                  : <></>
                }
                { item && item.legs && item.legs.length > 0
                  ? <MaterialTable columns={columns} data={item.legs} 
                        options={{ search: false, paging: false, toolbar:false,
                                showEmptyDataSourceMessage: false, 
                                showTitle: false,
                                headerStyle:{ fontWeight: 'bolder', fontSize: 'larger' } 
                                }}
                    />
                  : <></>
                }
            </>
           );
       });
    }

    const handleChange = (event: React.ChangeEvent<any>) : void => {
        const name = event.currentTarget.name;
        const value = event.currentTarget.type === 'checkbox' 
                    ? event.currentTarget.checked : event.currentTarget.value;
        setInputs(values => ({...values, [name]: value}))
      }
    
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) : void => {
        event.preventDefault();
        
        axios.post('http://localhost/orders', 
          { fromStand : inputs.fromStand, 
            toStand : inputs.toStand, 
            maxWait : inputs.maxWait, 
            maxLoss : inputs.maxLoss, 
            shared : inputs.shared,
            atTime : inputs.atTime ? inputs.atTime.replace('T',' ') + ":00" : inputs.atTime
          },
          { auth: credentials(custId) }) //{...inputs})
          .then(function (response) {
            setOrders(parseResponse(new Array(response.data)));
          })
          .catch(function (error) {
            alert(error);
          });
    }
    
    const handleAccept = (id: number) => {
        
        axios.post('http://localhost/orders', 
          { fromStand : inputs.fromStand, 
            toStand : inputs.toStand, 
            maxWait : inputs.maxWait, 
            maxLoss : inputs.maxLoss, 
            shared : inputs.shared,
            atTime : inputs.atTime ? inputs.atTime.replace('T',' ') + ":00" : inputs.atTime
          },
          { auth: credentials(custId) }) //{...inputs})
          .then(function (response) {
            setOrders(parseResponse(new Array(response.data)));
          })
          .catch(function (error) {
            alert(error);
          });
    }

    return (
        <div className="wrapper">
            <div className="nav">
                <img src={logo} style={{ width: '40px' }} alt="logo" />
            </div>
            { orders && orders.length > 0 
              ? <div className="main">
                    <div>Customer: {custId}</div>
                    {renderRoutes()}
                </div>
              : <form onSubmit={handleSubmit}>
                <h2> Request a cab </h2>
                <table><tbody>
                  <tr>
                    <td align='right'><label>From :</label></td>
                    <td align='left'>
                        <select name="fromStand" onChange={handleChange}>
                        {stops.map((stop, index) =>
                            <option key={index} value={stop.id}>
                                {stop.name}
                            </option>
                        )}
                        </select>
                    </td>
                   </tr> 
                   <tr>
                    <td align='right'><label>To :</label></td>
                    <td align='left'>
                        <select name="toStand" onChange={handleChange}>
                        {stops.map((stop, index) =>
                            <option key={index} value={stop.id}>
                                {stop.name}
                            </option>
                        )}
                        </select>
                    </td>
                   </tr> 
                   <tr>
                    <td align='right'><label>Max wait :</label></td>
                    <td align='left'>
                        <input 
                            type="number" 
                            name="maxWait"
                            value={inputs.maxWait || ""} 
                            onChange={handleChange}
                            style={{ width:'5ch' }}
                        />
                        <label> min</label>
                    </td>
                   </tr>
                   <tr>
                    <td align='right'><label>Shared? :</label></td>
                    <td align='left'>
                        <input 
                            type="checkbox" 
                            name="shared"
                            checked={inputs.shared} 
                            onChange={handleChange}
                        />
                    </td>
                   </tr>
                   <tr>
                    <td align='right'><label>Max loss while shared :</label></td>
                    <td align='left'>
                        <input 
                            type="number" 
                            name="maxLoss"
                            value={inputs.maxLoss || ""} 
                            onChange={handleChange}
                            style={{ width:'5ch' }}
                        />
                        <label> %</label>
                    </td>
                   </tr>
                   <tr>
                    <td align='right'><label>Required at :</label></td>
                    <td align='left'>
                        <input 
                            type="datetime-local" 
                            name="atTime"
                            value={inputs.atTime || ""} 
                            onChange={handleChange}
                        />
                    </td>
                   </tr>
                   <tr><td></td>
                       <td style={{ padding : "20px" }}>
                           <input type="submit" value="Send request" />
                        </td>
                   </tr>
                   </tbody></table>
                </form>
            }
        </div>
    )
}


class TaxiOrder  {
    order: TripOrder;
    legs: TripLeg[];
    constructor(order: TripOrder, legs: TripLeg[]) {
        this.order = order;
        this.legs = legs;
    }
}

class TripLeg {
    stop: string;
    status: string;
    distance: number;
    
    constructor(
        stop: string,
        status: string,
        distance: number
    ) {
        this.stop = stop;
        this.status = status;
        this.distance = distance;
    }
}

class TripOrder {
    id: number;
    status: string;
    fromStand: number;
    toStand: number;
    distance: number;
    maxWait: number;
    maxLoss: number;
    shared: boolean;
    received: string;
    started: string;
    completed: string;
    atTime?: Date;
    eta?: number;
    inPool: boolean;
    cab: string;
    leg: Leg;
    route?: Route;

    constructor(
        id: number,
        status: string,
        fromStand: number,
        toStand: number,
        distance: number,
        maxWait: number,
        maxLoss: number,
        shared: boolean,
        received: string,
        started: string,
        completed: string,
        atTime: Date,
        eta: number,
        inPool: boolean,
        cab: Cab,
        leg: Leg,
        route?: Route) {
            this.id = id;
            this.status = status;
            this.fromStand = fromStand;
            this.toStand = toStand;
            this.maxWait = maxWait;
            this.maxLoss = maxLoss;
            this.shared = shared;
            this.received = received;
            this.atTime = atTime;
            this.eta = eta > -1 ? eta : undefined;
            this.inPool = inPool;
            let cabId = cab && cab.id ? cab.id.toString() : "Waiting for assignment ...";
            this.cab = cab && cab.name ? cab.name : cabId;
            this.leg = leg;
            this.route = route;
            this.distance = distance;
            this.started = started;
            this.completed = completed;
    }
}
export interface Order {
    id: number;
    status: string;
    fromStand: number;
    toStand: number;
    distance: number
    maxWait: number;
    maxLoss: number;
    shared: boolean;
    received: Date;
    started: Date;
    completed: Date;
    atTime?: any;
    eta: number;
    inPool: boolean;
    cab: Cab;
    customer: Customer;
    leg: Leg;
    route?: Route;
}

export interface Customer {
    id: number;    
}

export interface Route {
    id: number;
    status: string;
    cab: Cab;
    legs: Leg[];
}

export interface Leg {
    id: number;
    fromStand: number;
    toStand: number;
    distance: number;
    place: number;
    status: string;
    started: Date;
    completed: Date;
}

export interface Cab {
    id: number;
    location: number;
    name: string;
    status: string;
}

export interface Stop {
    id: number;
    no: string;
    name: string;
    type: string;
    bearing?: any;
    latitude: number;
    longitude: number;
}