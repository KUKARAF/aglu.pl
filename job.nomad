job "nginx-static" {
  datacenters = ["dc1"]
  type = "service"

  group "nginx" {
    count = 1

    network {
      port "http" {
        static = 8987
      }
    }

    task "nginx" {
      driver = "docker"

      config {
        image = "nginx-static:latest"
        ports = ["http"]
      }

      resources {
        cpu    = 500
        memory = 256
      }
    }
  }
}
