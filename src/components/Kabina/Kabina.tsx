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

    let custId = 0; // default
    
    if (location && location.search) {
        const json = parse(location.search);
        let id = json['cust_id'];
        if (id) {
            custId = Number(id);
        }
    }

    const columns = [
        { title: 'From', field: 'from'},
        { title: 'To', field: 'to'},
        { title: 'Status', field: 'status'},
    ];

    const orderColumns = [
        { title: 'ID', field: 'id'},
        { title: 'Status', field: 'status'},
        { title: 'From', field: 'from'},
        { title: 'To', field: 'to'},
        { title: 'Max wait', field: 'maxWait'},
        { title: 'Shared', field: 'shared'},
        { title: 'In pool', field: 'inPool'},
        { title: 'Received', field: 'rcvdTime'},
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
            if (!order.route || order.route.status === 'COMPLETED') { 
                continue; 
            }
            let rowArr: TripLeg[] = [];
            let firstFound = false;
            for (let leg of order.route.legs) {
                // find the firt leg for this customer
                if (!firstFound && leg.fromStand === order.fromStand) {
                    firstFound = true;
                }
                if (firstFound) {
                    rowArr.push(new TripLeg(
                        stopName(leg.fromStand),
                        stopName(leg.toStand),
                        leg.status,
                        0
                    ));
                }
                if (leg.toStand === order.toStand) {
                    break;
                }
            }
            orderArr.push(new TaxiOrder(
                new TripOrder(
                    order.id, 
                    order.status,
                    stopName(order.fromStand),
                    stopName(order.toStand),
                    order.maxWait,
                    order.maxLoss,
                    order.shared,
                    order.rcvdTime,
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
        axios.get('http://localhost:8080/orders', { auth: credentials(custId) })
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
        axios.get('http://localhost:8080/stops', { auth: credentials(0) })
        .then(response => setStops(response.data)); 
    }, []);


    function renderHeader(order: TripOrder) {
      return ( 
        <table>
            <tr><th align='right'>Order ID: </th>       <td align='left'>{order.id}</td></tr>
            <tr><th align='right'>Status: </th>   <td align='left'>{order.status}</td></tr>
            <tr><th align='right'>From: </th>     <td align='left'>{order.fromStand}</td></tr>
            <tr><th align='right'>To: </th>       <td align='left'>{order.toStand}</td></tr>
            <tr><th align='right'>Max wait: </th> <td align='left'>{order.maxWait}</td></tr>
            <tr><th align='right'>Shared: </th>   <td align='left'>{order.shared}</td></tr>
            <tr><th align='right'>In pool: </th>  <td align='left'>{order.inPool}</td></tr>
            <tr><th align='right'>Received: </th> <td align='left'>{order.rcvdTime}</td></tr>
            <tr><th align='right'>At time: </th>  <td align='left'>{order.atTime}</td></tr>
            <tr><th align='right'>ETA: </th>      <td align='left'>{order.eta}</td></tr>
            <tr><th align='right'>Cab: </th>      <td align='left'>{order.cab}</td></tr>
            <tr><th align='right'>Route: </th>    <td align='left'>{order.route.id}</td></tr>
        </table>
      );
    }

    function renderRoutes() {
        return orders.map((item, index) => {
           return ( 
            <>
                {renderHeader(item.order)}
                <MaterialTable columns={columns} data={item.legs} 
                    options={{ search: false,  
                            paging: false, 
                            showEmptyDataSourceMessage: false, 
                            showTitle: false
                            }}/>
            </>
           );
       });
    }

    return (
        <div className="wrapper">
            <div className="nav">
                <img src={logo} style={{ width: '40px' }} alt="logo" />
            </div>
            <div className="main">
                <div>Customer: {custId}</div>
                {renderRoutes()}
            </div>
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
    from: string;
    to: string;
    status: string;
    distance: number;
    
    constructor(
        from: string,
        to: string,
        status: string,
        distance: number
    ) {
        this.from = from;
        this.to = to;
        this.status = status;
        this.distance = distance;
    }
}

class TripOrder {
    id: number;
    status: string;
    fromStand: string;
    toStand: string;
    maxWait: number;
    maxLoss: number;
    shared: boolean;
    rcvdTime: Date;
    atTime?: Date;
    eta: number;
    inPool: boolean;
    cab: string;
    leg: Leg;
    route: Route;

    constructor(
        id: number,
        status: string,
        fromStand: string,
        toStand: string,
        maxWait: number,
        maxLoss: number,
        shared: boolean,
        rcvdTime: Date,
        atTime: Date,
        eta: number,
        inPool: boolean,
        cab: Cab,
        leg: Leg,
        route: Route) {
            this.id = id;
            this.status = status;
            this.fromStand = fromStand;
            this.toStand = toStand;
            this.maxWait = maxWait;
            this.maxLoss = maxLoss;
            this.shared = shared;
            this.rcvdTime = rcvdTime;
            this.atTime = atTime;
            this.eta = eta;
            this.inPool = inPool;
            this.cab = route.cab.name && route.cab.name.length > 0 
                            ? route.cab.name : route.cab.id.toString();
            this.leg = leg;
            this.route = route;
    }
}
export interface Order {
    id: number;
    status: string;
    fromStand: number;
    toStand: number;
    maxWait: number;
    maxLoss: number;
    shared: boolean;
    rcvdTime: Date;
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