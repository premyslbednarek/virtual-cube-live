import React, { createContext, useState, useEffect } from "react"

export interface IUserContext {
    isLogged: boolean,
    username: string
}

const defaultContext: IUserContext = {
    isLogged: false,
    username: ""
}

export const UserContext = createContext(defaultContext)

export function UserContextProvider({children} : {children: React.ReactNode}) {
    const [userContext, setUserContext] = useState<IUserContext>(defaultContext);

    useEffect(() => {
        fetch('/api/user_info').then(res => res.json()).then((data: IUserContext) => {
            setUserContext(data);
        })
    }, [])

    return (
        <UserContext.Provider value={userContext}>
            {children}
        </UserContext.Provider>
    );

}