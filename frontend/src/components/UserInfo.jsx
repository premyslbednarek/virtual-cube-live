import { useContext } from "react"; import { UserContext } from "../userContext"; import { Link } from "react-router-dom";
import { Button, Space } from "@mantine/core";

export default function UserInfo() {
    const { userContext, fetchData } = useContext(UserContext);

    const logout = () => {
        fetch("/logout").then(res => {
            if (res.status === 200) {
                console.log("logout successfull");
                fetchData();
            }
        });
    }

    if (userContext.isLogged) {
        return (
            <>
                <p>You are logged in as {userContext.username}</p>
                <Button onClick={logout}>Logout</Button>
            </>
        );
    }

    return (
        <div style={{display: "flex"}}>
            <Link to="/login">
                <Button>
                Login
                </Button>
            </Link>
            <Space w="md" />
            <Link to="/register">
                <Button>
                Register
                </Button>
            </Link>
        </div>
    );
}