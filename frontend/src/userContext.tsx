import React, { createContext, useState, useEffect } from "react"

export interface IUserInfo {
    isLogged: boolean;
    username: string;
    isAdmin: boolean;
}

export interface IUserContext {
    userContext: IUserInfo;
    fetchData: () => void;
}

const defaultUserInfo: IUserInfo = {
    isLogged: false,
    username: "",
    isAdmin: false,
}

const defaultContext: IUserContext = {
    userContext: defaultUserInfo,
    fetchData: () => {}
}

export const UserContext = createContext<IUserContext>(defaultContext)

export function UserContextProvider({children} : {children: React.ReactNode}) {
    const [userContext, setUserContext] = useState<IUserInfo>(defaultUserInfo);

    const fetchData = () => {
        fetch('/api/user_info').then(res => res.json()).then((data: IUserInfo) => {
            setUserContext(data);
        })
    }

    useEffect(() => {
        fetchData();
    }, [])


    return (
        <UserContext.Provider value={{userContext, fetchData}}>
            {children}
        </UserContext.Provider>
    );

}