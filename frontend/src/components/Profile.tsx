import { useContext } from "react"
import { UserContext } from "../userContext"
import { User } from "./UserPage";

export default function Profile() {
    const { userContext } = useContext(UserContext)

    return (
        <User username={userContext.username} />
    );
}